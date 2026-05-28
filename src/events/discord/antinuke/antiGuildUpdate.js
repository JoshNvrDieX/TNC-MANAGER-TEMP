import { AuditLogEvent } from 'discord.js';
import { AntinukeEngine } from '#classes/antinukeEngine';
import { db } from '#dbManager';
import { logger } from '#utils';

export default {
	name: 'guildUpdate',
	async execute({ eventArgs, client }) {
		const [oldGuild, newGuild] = eventArgs;

		const cfg = db.antinuke?.get(newGuild.id);
		if (!cfg?.enabled) return;

		// Anti-vanity URL change
		if (cfg.antiVanityEnabled && oldGuild.vanityURLCode && oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
			try {
				const logs = await newGuild.fetchAuditLogs({ type: AuditLogEvent.GuildUpdate, limit: 1 });
				const entry = logs.entries.first();
				if (entry && Date.now() - entry.createdTimestamp <= 5000) {
					const executorId = entry.executor?.id;
					if (executorId) {
						await AntinukeEngine.handle(newGuild, executorId, 'VANITY_CHANGE', {
							targetId: null,
							targetData: { old: oldGuild.vanityURLCode, new: newGuild.vanityURLCode },
							limitCheck: false, // one change = instant action
							recover: async () => {
								// Attempt to revert vanity
								await newGuild.setVanityCode(oldGuild.vanityURLCode, '[Antinuke] Vanity revert').catch(() => {});
							},
						});
					}
				}
			} catch (e) {
				logger.error('AntiVanity', e.message);
			}
			return;
		}

		// Anti-server settings change (name, icon, verification level, etc.)
		if (!cfg.antiGuildUpdateEnabled) return;

		const sensitiveChanges = [
			oldGuild.name !== newGuild.name,
			oldGuild.verificationLevel !== newGuild.verificationLevel,
			oldGuild.explicitContentFilter !== newGuild.explicitContentFilter,
			oldGuild.mfaLevel !== newGuild.mfaLevel,
		].some(Boolean);

		if (!sensitiveChanges) return;

		try {
			const logs = await newGuild.fetchAuditLogs({ type: AuditLogEvent.GuildUpdate, limit: 1 });
			const entry = logs.entries.first();
			if (!entry || Date.now() - entry.createdTimestamp > 5000) return;

			const executorId = entry.executor?.id;
			if (!executorId) return;

			await AntinukeEngine.handle(newGuild, executorId, 'GUILD_SETTINGS_CHANGE', {
				limitCheck: false,
				recover: async () => {
					const backup = db.antinuke?.getBackup(newGuild.id);
					if (!backup) return;
					// Revert name if changed
					if (oldGuild.name !== newGuild.name) {
						await newGuild.setName(oldGuild.name, '[Antinuke] Auto-recovery').catch(() => {});
					}
				},
			});
		} catch (e) {
			logger.error('AntiGuildUpdate', e.message);
		}
	},
};
