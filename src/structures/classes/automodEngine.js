import { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { config } from '#config';
import { tracker } from '#classes/automodTracker';
import { db } from '#dbManager';
import { smartCache } from '#classes/dbCache';
import { logger } from '#utils';

// ── Compiled regexes ───────────────────────────────────────────────────────────
const URL_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
const INVITE_REGEX = /discord(?:\.gg|app\.com\/invite|\.com\/invite)\/[a-zA-Z0-9-]+/gi;
const EMOJI_REGEX = /(\p{Emoji_Presentation}|\p{Extended_Pictographic}|<a?:\w+:\d+>)/gu;
// Zalgo: combining diacritical marks
const ZALGO_REGEX = /[\u0300-\u036f\u0489\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]{3,}/g;
// Scam / phishing patterns
const SCAM_PATTERNS = [
	/free.?nitro/i, /discord.?gift/i, /steam.?gift/i, /claim.?prize/i,
	/verify.?account/i, /account.?suspended/i, /click.?here.?to.?claim/i,
	/discordgift\./i, /dlscord\./i, /discocrd\./i, /steamcommunity\.ru/i,
	/grabify\.link/i, /iplogger\./i, /blasze\.tk/i,
];

export class AutomodEngine {
	/**
	 * Main entry — run all enabled checks on a message.
	 * Checks run in priority order; stops after first violation.
	 */
	static async check(message) {
		if (!message.guild || message.author?.bot) return;

		// Use smartCache — avoids SQLite hit on every single message
		const cfg = smartCache.automod(message.guild.id);
		if (!cfg?.enabled) return;

		const ext = smartCache.automodExt(message.guild.id);
		const { member, channel } = message;

		// Bypass: whitelisted channel or role, or mod
		if (cfg.whitelistedChannels?.includes(channel.id)) return;
		if (member?.roles?.cache?.some(r => cfg.whitelistedRoles?.includes(r.id))) return;
		if (member?.permissions?.has(PermissionFlagsBits.ManageMessages)) return;

		const checks = [
			() => this._checkScam(message, ext),
			() => this._checkInvite(message, cfg),
			() => this._checkLink(message, cfg),
			() => this._checkWordFilter(message, cfg),
			() => this._checkZalgo(message, ext),
			() => this._checkMentionSpam(message, cfg),
			() => this._checkSpam(message, cfg, ext),
			() => this._checkCaps(message, cfg),
			() => this._checkEmojiSpam(message, cfg),
			() => this._checkMediaFilter(message, ext),
		];

		for (const check of checks) {
			if (await check()) return;
		}
	}

	// ── Checks ─────────────────────────────────────────────────────────────────

	static async _checkSpam(message, cfg, ext) {
		if (!cfg.antiSpamEnabled) return false;
		const key = `spam:${message.guild.id}:${message.author.id}`;
		const count = tracker.hit(key, cfg.antiSpamInterval ?? 5000);

		// Auto-slowmode side effect
		if (ext?.autoSlowmodeEnabled) {
			const smKey = `slowmode:${message.guild.id}:${message.channel.id}`;
			const smCount = tracker.hit(smKey, ext.autoSlowmodeInterval ?? 5000);
			if (smCount >= (ext.autoSlowmodeThreshold ?? 10)) {
				tracker.reset(smKey);
				message.channel.setRateLimitPerUser(ext.autoSlowmodeDuration ?? 10, '[Automod] Auto-slowmode').catch(() => {});
				setTimeout(() => message.channel.setRateLimitPerUser(0).catch(() => {}), 30_000);
			}
		}

		if (count >= (cfg.antiSpamLimit ?? 5)) {
			tracker.reset(key);
			await this._enforce(message, cfg.antiSpamAction, cfg.antiSpamMuteDuration, 'Spam detected', ext);
			return true;
		}
		return false;
	}

	static async _checkMentionSpam(message, cfg) {
		if (!cfg.antiMentionEnabled) return false;
		const userMentions = message.content.match(/<@!?\d+>/g)?.length || 0;
		const roleMentions = message.content.match(/<@&\d+>/g)?.length || 0;
		const count = userMentions + roleMentions;
		if (count >= (cfg.antiMentionLimit ?? 5)) {
			await this._enforce(message, cfg.antiMentionAction, cfg.antiMentionMuteDuration, 'Mention spam');
			return true;
		}
		return false;
	}

	static async _checkLink(message, cfg) {
		if (!cfg.antiLinkEnabled) return false;
		const urls = message.content.match(URL_REGEX);
		if (!urls) return false;
		const whitelist = cfg.antiLinkWhitelist ?? [];
		const blocked = urls.some(url => !whitelist.some(w => url.toLowerCase().includes(w.toLowerCase())));
		if (blocked) {
			await this._enforce(message, cfg.antiLinkAction, cfg.antiLinkMuteDuration, 'Unauthorized link');
			return true;
		}
		return false;
	}

	static async _checkInvite(message, cfg) {
		if (!cfg.antiInviteEnabled) return false;
		INVITE_REGEX.lastIndex = 0;
		const match = INVITE_REGEX.test(message.content);
		INVITE_REGEX.lastIndex = 0;
		if (match) {
			await this._enforce(message, cfg.antiInviteAction, cfg.antiInviteMuteDuration, 'Discord invite link');
			return true;
		}
		return false;
	}

	static async _checkCaps(message, cfg) {
		if (!cfg.antiCapsEnabled) return false;
		const letters = message.content.replace(/[^a-zA-Z]/g, '');
		if (letters.length < (cfg.antiCapsMinLength ?? 10)) return false;
		const pct = (letters.split('').filter(c => c === c.toUpperCase()).length / letters.length) * 100;
		if (pct >= (cfg.antiCapsThreshold ?? 70)) {
			await this._enforce(message, cfg.antiCapsAction, 0, `Excessive caps (${Math.round(pct)}%)`);
			return true;
		}
		return false;
	}

	static async _checkEmojiSpam(message, cfg) {
		if (!cfg.antiEmojiEnabled) return false;
		EMOJI_REGEX.lastIndex = 0;
		const matches = message.content.match(EMOJI_REGEX);
		EMOJI_REGEX.lastIndex = 0;
		if (matches && matches.length >= (cfg.antiEmojiLimit ?? 10)) {
			await this._enforce(message, cfg.antiEmojiAction, 0, 'Emoji spam');
			return true;
		}
		return false;
	}

	static async _checkWordFilter(message, cfg) {
		if (!cfg.wordFilterEnabled) return false;
		const words = cfg.wordFilterList ?? [];
		const regexes = cfg.regexFilterList ?? [];
		if (!words.length && !regexes.length) return false;

		const lower = message.content.toLowerCase();

		// 1. Exact/Partial matches
		const wordHit = words.find(w => lower.includes(w));
		if (wordHit) {
			await this._enforce(message, cfg.wordFilterAction, cfg.wordFilterMuteDuration, `Filtered word`);
			return true;
		}

		// 2. Regex matches
		for (const pattern of regexes) {
			try {
				const regex = new RegExp(pattern, 'i');
				if (regex.test(message.content)) {
					await this._enforce(message, cfg.wordFilterAction, cfg.wordFilterMuteDuration, `Filtered pattern (regex)`);
					return true;
				}
			} catch {}
		}

		return false;
	}

	static async _checkZalgo(message, ext) {
		if (!ext?.antiZalgoEnabled) return false;
		ZALGO_REGEX.lastIndex = 0;
		const match = ZALGO_REGEX.test(message.content);
		ZALGO_REGEX.lastIndex = 0;
		if (match) {
			await this._enforce(message, ext.antiZalgoAction ?? 'delete', 0, 'Zalgo text');
			return true;
		}
		return false;
	}

	static async _checkScam(message, ext) {
		if (!ext?.antiScamEnabled) return false;
		const hit = SCAM_PATTERNS.some(p => p.test(message.content));
		if (hit) {
			await this._enforce(message, ext.antiScamAction ?? 'ban', 0, 'Scam/phishing link');
			return true;
		}
		return false;
	}

	static async _checkMediaFilter(message, ext) {
		if (!ext?.mediaFilterEnabled) return false;
		if (!message.attachments.size) return false;
		const blocked = ext.mediaFilterBlockedTypes ?? [];
		if (!blocked.length) return false;
		const hasBlocked = message.attachments.some(a => {
			const ext2 = a.name?.split('.').pop()?.toLowerCase();
			return ext2 && blocked.includes(ext2);
		});
		if (hasBlocked) {
			await this._enforce(message, ext.mediaFilterAction ?? 'delete', 0, 'Blocked file type');
			return true;
		}
		return false;
	}

	// ── Ghost ping detection (called from messageDelete event) ─────────────────
	static async checkGhostPing(message) {
		if (!message.guild || message.author?.bot) return;
		const ext = db.automodExt?.get(message.guild.id);
		if (!ext?.antiGhostPingEnabled) return;
		if (!message.mentions.users.size && !message.mentions.roles.size) return;

		const cfg = db.automod?.get(message.guild.id);
		const ghostLogChannelId = db.logging?.get(message.guild.id)?.automodChannel ?? cfg?.logChannel;
		if (!ghostLogChannelId) return;

		const ch = message.guild.channels.cache.get(ghostLogChannelId);
		if (!ch?.isTextBased()) return;

		const mentioned = [...message.mentions.users.values()].map(u => u.tag).join(', ');
		ch.send({
			content: [
				`👻 **Ghost Ping Detected**`,
				`**User:** ${message.author.tag} (\`${message.author.id}\`)`,
				`**Channel:** <#${message.channel.id}>`,
				`**Pinged:** ${mentioned}`,
				`**Content:** \`${message.content.slice(0, 200)}\``,
			].join('\n'),
		}).catch(() => {});

		if (ext.antiGhostPingAction === 'warn') {
			await this._warn(message.guild, message.author.id, message.client.user.id, 'Ghost ping');
		}
	}

	// ── Enforcement ────────────────────────────────────────────────────────────
	static async _enforce(message, action = 'delete', muteDuration = 300_000, reason = 'Automod', ext = null) {
		const { member, guild, channel, author } = message;

		await message.delete().catch(() => {});

		// Notify user in channel (if possible) using a simple container message
		const botMember = guild.members.me ?? guild.members.cache.get(guild.client.user.id);
		if (channel?.isTextBased && botMember && channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages)) {
			try {
				const container = new ContainerBuilder().setAccentColor(config.colors.bot ?? 0x5865F2);
				
				container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${reason} Triggered`));
				container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
				
				container.addTextDisplayComponents(new TextDisplayBuilder().setContent([
					`- **User :** <@${author.id}>`,
					`- **Timestamp :** <t:${Math.floor(Date.now() / 1000)}:F>`,
					`- **Action :** \`${action.toUpperCase()}\``
				].join('\n')));

				container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
				
				const notes = {
					'Mention spam': 'PLEASE DONT MENTION MULTIPLE TIMES IN AN ROW',
					'Spam detected': 'Please slow down and avoid sending messages too quickly',
					'Unauthorized link': 'Sending links is not allowed in this channel',
					'Discord invite link': 'Discord invite links are strictly prohibited',
					'Excessive caps': 'Please avoid using excessive capital letters',
					'Emoji spam': 'Please limit the number of emojis in your messages',
					'Filtered word': 'Your message contained a blacklisted word',
					'Filtered pattern (regex)': 'Your message matched a prohibited text pattern',
					'Zalgo text': 'Zalgo/Glitch text is not allowed here',
					'Scam/phishing link': 'Warning: Suspicious link detected. Do not click links from unknown sources',
					'Blocked file type': 'This file type is not permitted in this server',
				};

				const note = notes[reason];
				if (note) {
					container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${note.toUpperCase()}`));
				}
				
				container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`- **TNC MANAGEMENT**`));

				await channel.send({ 
					components: [container],
					flags: MessageFlags.IsComponentsV2 
				}).then(m => setTimeout(() => m.delete().catch(() => {}), 30000));
			} catch (e) {
				logger.error('Automod', `Failed to send warning container: ${e.message}`);
			}
		}


		const cfg = db.automod?.get(guild.id);
		// Log to automod channel (falls back to logChannel)
		const logChannelId = smartCache.logging(guild.id)?.automodChannel ?? cfg?.logChannel;
		if (logChannelId) {
			const logCh = guild.channels.cache.get(logChannelId);
			if (logCh?.isTextBased()) {
				const logContainer = new ContainerBuilder().setAccentColor(config.colors.error ?? 0xFF0000);
				
				logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${reason} Triggered`));
				logContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
				
				logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent([
					`- **User :** <@${author.id}>`,
					`- **Timestamp :** <t:${Math.floor(Date.now() / 1000)}:F>`,
					`- **Action :** \`${action.toUpperCase()}\``,
					`- **Channel :** <#${channel.id}>`,
					`- **Content :** \`\`\`${message.content.slice(0, 200)}\`\`\``
				].join('\n')));

				logContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
				logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`- **TNC MANAGEMENT**`));

				logCh.send({ 
					components: [logContainer],
					flags: MessageFlags.IsComponentsV2 
				}).catch(() => {});
			}
		}

		try {
			switch (action) {
				case 'warn':
					await this._warn(guild, author.id, guild.client.user.id, reason);
					break;
				case 'mute':
					if (member?.moderatable) await member.timeout(muteDuration || 300_000, reason);
					break;
				case 'kick':
					if (member?.kickable) await member.kick(reason);
					break;
				case 'ban':
					if (member?.bannable) await member.ban({ reason, deleteMessageSeconds: 0 });
					break;
				case 'delete':
				default:
					break;
			}
		} catch (err) {
			logger.error('Automod', `Enforcement failed (${action}): ${err.message}`);
		}

		// 3. Optional: Auto-warn escalation
		if (ext && action !== 'ban' && action !== 'kick') {
			const warnCount = await this._warn(guild, author.id, guild.client.user.id, reason);
			if (warnCount >= (ext.warnBanThreshold ?? 7)) {
				if (member?.bannable) await member.ban({ reason: `[Automod] ${warnCount} warnings`, deleteMessageSeconds: 0 }).catch(() => {});
			} else if (warnCount >= (ext.warnKickThreshold ?? 5)) {
				if (member?.kickable) await member.kick(`[Automod] ${warnCount} warnings`).catch(() => {});
			} else if (warnCount >= (ext.warnMuteThreshold ?? 3)) {
				if (member?.moderatable) await member.timeout(ext.warnMuteDuration ?? 300_000, `[Automod] ${warnCount} warnings`).catch(() => {});
			}
		}
	}

	/** Add a warning and return the new total count */
	static async _warn(guild, userId, moderatorId, reason) {
		return db.automodExt?.addWarning(guild.id, userId, moderatorId, reason) ?? 0;
	}
}
