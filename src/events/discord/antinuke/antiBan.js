import { AuditLogEvent } from 'discord.js';
import { AntinukeEngine } from '#classes/antinukeEngine';
import { db } from '#dbManager';
import { logger } from '#utils';

export default {
	name: 'guildBanAdd',
	async execute({ eventArgs, client }) {
		const [ban] = eventArgs;
		const guild = ban.guild;
		if (!guild) return;

		const cfg = db.antinuke?.get(guild.id);
		if (!cfg?.enabled || !cfg.antiBanEnabled) return;

		try {
			await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 }).then(async logs => {
				const entry = logs.entries.first();
				if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
				const executorId = entry.executor?.id;
				if (!executorId) return;

				await AntinukeEngine.handle(guild, executorId, 'BAN_ADD', {
					targetId: ban.user?.id,
					limit: cfg.antiBanLimit,
					interval: cfg.antiBanInterval,
					recover: async () => {
						await guild.members.unban(ban.user.id, '[Antinuke] Auto-recovery').catch(() => {});
					},
				});
			});
		} catch (e) {
			logger.error('AntiBan', e.message);
		}
	},
};
