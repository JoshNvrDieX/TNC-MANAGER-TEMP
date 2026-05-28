import { PermissionFlagsBits, AuditLogEvent, ChannelType, ContainerBuilder, TextDisplayBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { config } from '#config';
import { db } from '#dbManager';
import { smartCache } from '#classes/dbCache';
import { logger } from '#utils';

// In-memory sliding window tracker
const _windows = new Map();
setInterval(() => {
	const now = Date.now();
	for (const [k, ts] of _windows) {
		const fresh = ts.filter(t => now - t < 120_000);
		if (!fresh.length) _windows.delete(k); else _windows.set(k, fresh);
	}
}, 60_000);

function hit(key, windowMs) {
	const now = Date.now();
	const ts = (_windows.get(key) ?? []).filter(t => now - t < windowMs);
	ts.push(now);
	_windows.set(key, ts);
	return ts.length;
}

function resetKey(key) { _windows.delete(key); }

// Dangerous URL patterns (token grabbers, phishing, IP loggers)
const DANGEROUS_PATTERNS = [
	/discord(?:app)?\.gift/i,
	/free-nitro/i,
	/steamcommunity\.ru/i,
	/grabify\.link/i,
	/iplogger\./i,
	/blasze\.tk/i,
	/discord-nitro\.gift/i,
	/discordgift\.site/i,
	/dlscord\./i,
	/discocrd\./i,
];

export class AntinukeEngine {
	/**
	 * Main entry point. Call from every audit log event.
	 * @param {import('discord.js').Guild} guild
	 * @param {string} executorId
	 * @param {string} actionType  - e.g. 'BAN_ADD', 'CHANNEL_DELETE', etc.
	 * @param {Object} opts
	 * @param {string} [opts.targetId]
	 * @param {Object} [opts.targetData]   - snapshot for recovery
	 * @param {Function} [opts.recover]    - async fn to call if recovery is enabled
	 * @param {boolean} [opts.limitCheck]  - whether to apply rate-limit threshold
	 * @param {number}  [opts.limit]
	 * @param {number}  [opts.interval]
	 */
	static async handle(guild, executorId, actionType, opts = {}) {
		if (!guild || !executorId) return;

		const cfg = smartCache.antinuke(guild.id);
		if (!cfg?.enabled) return;

		// Owner / trusted bypass
		if (AntinukeEngine.isTrusted(guild, executorId, cfg)) return;

		const { targetId, targetData, recover, limitCheck = true, limit = 3, interval = 10_000 } = opts;

		// 1. Log the event to Discord (Always do this if it's a suspicious event from non-trusted)
		await AntinukeEngine.logSecurityEvent(guild, executorId, actionType, targetId);

		// 2. Rate-limit check
		if (limitCheck) {
			const key = `${actionType}:${guild.id}:${executorId}`;
			const count = hit(key, interval);
			if (count < limit) return; // under threshold — not a nuke yet
			resetKey(key);
		}

		// 3. Persistent Database Log (Nuke level)
		db.antinuke?.logAction(guild.id, executorId, actionType, targetId, targetData);

		// 4. Punish & Alert
		await AntinukeEngine.punish(guild, executorId, cfg, actionType);
		await AntinukeEngine.alert(guild, executorId, actionType, cfg, targetId);

		// Lockdown check
		if (cfg.lockdownEnabled) {
			const lockdownKey = `lockdown:${guild.id}`;
			const totalHits = hit(lockdownKey, 30_000); // multiple types of hits in 30s
			if (totalHits >= (cfg.lockdownThreshold || 5)) {
				await AntinukeEngine.lockdown(guild, cfg);
				resetKey(lockdownKey);
			}
		}

		// Recover
		if (cfg.autoRecovery && typeof recover === 'function') {
			try { await recover(); } catch (e) { logger.error('Antinuke', `Recovery failed for ${actionType}: ${e.message}`); }
		}
	}

	/** Check if executor is trusted (owner, ownerIds, trustedAdmins, or the bot itself) */
	static isTrusted(guild, executorId, cfg) {
		if (!executorId) return true;
		if (executorId === guild.client.user.id) return true;
		if (executorId === guild.ownerId) return true;
		if ((cfg.ownerIds ?? []).includes(executorId)) return true;
		if ((cfg.trustedAdmins ?? []).includes(executorId)) return true;
		return false;
	}

	/** Apply punishment to the executor */
	static async punish(guild, executorId, cfg, reason) {
		const member = guild.members.cache.get(executorId) ?? await guild.members.fetch(executorId).catch(() => null);
		if (!member) return;

		// Never punish the bot itself or the guild owner
		if (member.id === guild.client.user.id || member.id === guild.ownerId) return;

		const type = cfg.punishmentType ?? 'ban';
		logger.warn('Antinuke', `Punishing ${member.user.tag} (${type}) for: ${reason}`);

		try {
			switch (type) {
				case 'ban':
					if (member.bannable) await guild.members.ban(executorId, { reason: `[Antinuke] ${reason}`, deleteMessageSeconds: 0 });
					break;
				case 'kick':
					if (member.kickable) await member.kick(`[Antinuke] ${reason}`);
					break;
				case 'strip_roles': {
					const dangerousPerms = [
						PermissionFlagsBits.Administrator,
						PermissionFlagsBits.ManageGuild,
						PermissionFlagsBits.ManageChannels,
						PermissionFlagsBits.ManageRoles,
						PermissionFlagsBits.BanMembers,
						PermissionFlagsBits.KickMembers,
						PermissionFlagsBits.ManageWebhooks,
					];
					const rolesToRemove = member.roles.cache.filter(r =>
						r.id !== guild.id && dangerousPerms.some(p => r.permissions.has(p))
					);
					for (const [, role] of rolesToRemove) {
						await member.roles.remove(role, `[Antinuke] ${reason}`).catch(() => {});
					}
					break;
				}
				case 'quarantine': {
					const qRole = cfg.quarantineRole ? guild.roles.cache.get(cfg.quarantineRole) : null;
					if (qRole && member.manageable) {
						const currentRoles = member.roles.cache.filter(r => r.id !== guild.id).map(r => r.id);
						await member.roles.set([qRole.id], `[Antinuke] ${reason}`).catch(() => {});
						// Store original roles for potential unquarantine
						db.antinuke?.logAction(guild.id, executorId, 'QUARANTINE', executorId, { roles: currentRoles });
					}
					break;
				}
			}
		} catch (e) {
			logger.error('Antinuke', `Punishment failed: ${e.message}`);
		}
	}

	/** Log every suspicious event to the log channel (even if threshold not met) */
	static async logSecurityEvent(guild, executorId, actionType, targetId = null) {
		const cfg = db.antinuke?.get(guild.id);
		const channelId = cfg?.logChannel;
		if (!channelId) return;

		const channel = guild.channels.cache.get(channelId);
		if (!channel?.isTextBased()) return;

		const logContainer = new ContainerBuilder().setAccentColor(config.colors.warn ?? 0xFFAA00);
		
		logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🛡️ Security Log`));
		logContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
		
		logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent([
			`- **Action :** \`${actionType}\``,
			`- **Executor :** <@${executorId}> (\`${executorId}\`)`,
			`- **Target :** \`${targetId || 'N/A'}\``,
			`- **Status :** \`MONITORING\``,
			`- **Timestamp :** <t:${Math.floor(Date.now() / 1000)}:R>`
		].join('\n')));

		logContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
		logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`- **TNC MANAGEMENT**`));

		channel.send({ 
			components: [logContainer],
			flags: MessageFlags.IsComponentsV2 
		}).catch(() => {});
	}

	/** Send alert to log/alert channels */
	static async alert(guild, executorId, actionType, cfg, targetId = null) {
		const channelId = cfg.alertChannel ?? cfg.logChannel;
		if (!channelId) return;

		const channel = guild.channels.cache.get(channelId);
		if (!channel?.isTextBased()) return;

		const user = guild.client.users.cache.get(executorId) ?? await guild.client.users.fetch(executorId).catch(() => null);
		const userTag = user ? `${user.tag} (\`${executorId}\`)` : `\`${executorId}\``;
		const target = targetId ? `\`${targetId}\`` : 'N/A';
		const punishment = cfg.punishmentType ?? 'ban';

		const logContainer = new ContainerBuilder().setAccentColor(config.colors.error ?? 0xFF0000);
		
		logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🛡️ Antinuke Alert`));
		logContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
		
		logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent([
			`- **Action :** \`${actionType}\``,
			`- **Executor :** <@${executorId}> (\`${executorId}\`)`,
			`- **Target :** \`${targetId || 'N/A'}\``,
			`- **Punishment :** \`${punishment.toUpperCase()}\``,
			`- **Timestamp :** <t:${Math.floor(Date.now() / 1000)}:F>`
		].join('\n')));

		logContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
		logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# SECURITY SYSTEM HAS INTERVENED TO PROTECT THE SERVER`));
		logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`- **TNC MANAGEMENT**`));

		channel.send({ 
			components: [logContainer],
			flags: MessageFlags.IsComponentsV2 
		}).catch(() => {});
	}

	/** Trigger server-wide lockdown */
	static async lockdown(guild, cfg) {
		logger.error('Antinuke', `LOCKDOWN TRIGGERED for guild ${guild.id}`);

		// 1. Alert
		const logChannelId = cfg.alertChannel ?? cfg.logChannel;
		if (logChannelId) {
			const ch = guild.channels.cache.get(logChannelId);
			if (ch?.isTextBased()) {
				const lockdownContainer = new ContainerBuilder().setAccentColor(0x000000); // Pitch black for lockdown
				
				lockdownContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🔒 Lockdown Initiated`));
				lockdownContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
				
				lockdownContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent([
					`### Severe Attack Detected`,
					`The server has been placed under emergency lockdown. All non-trusted permissions have been revoked to secure the hierarchy.`
				].join('\n')));

				lockdownContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
				lockdownContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# LOCKDOWN MODE IS ACTIVE. TRUSTED ADMINS ONLY.`));
				lockdownContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`- **TNC MANAGEMENT**`));

				ch.send({ 
					components: [lockdownContainer],
					flags: MessageFlags.IsComponentsV2 
				}).catch(() => {});
			}
		}

		// 2. Restrict @everyone
		const everyone = guild.roles.everyone;
		try {
			await everyone.setPermissions(everyone.permissions.remove([
				PermissionFlagsBits.SendMessages,
				PermissionFlagsBits.SendMessagesInThreads,
				PermissionFlagsBits.CreatePublicThreads,
				PermissionFlagsBits.CreatePrivateThreads,
				PermissionFlagsBits.Connect,
				PermissionFlagsBits.Speak,
				PermissionFlagsBits.AddReactions,
			]), '[Antinuke] Server Lockdown').catch(() => {});
		} catch (e) {
			logger.error('Antinuke', `Lockdown failed to set @everyone perms: ${e.message}`);
		}

	}

	/** Check message content for dangerous URLs */
	static hasDangerousUrl(content) {
		return DANGEROUS_PATTERNS.some(p => p.test(content));
	}

	/** Take a full server backup snapshot */
	static async takeBackup(guild, name) {
		const { BackupManager } = await import('./backupManager.js');
		return BackupManager.createBackup(guild, name);
	}
}
