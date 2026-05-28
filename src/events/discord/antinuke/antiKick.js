import { AuditLogEvent } from 'discord.js';
import { AntinukeEngine } from '#classes/antinukeEngine';
import { db } from '#dbManager';
import { logger } from '#utils';

export default {
	name: 'guildMemberRemove',
	async execute({ eventArgs, client }) {
		const [member] = eventArgs;
		const guild = member.guild;
		if (!guild) return;

		const cfg = db.antinuke?.get(guild.id);
		if (!cfg?.enabled || !cfg.antiKickEnabled) return;

		try {
			const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 });
			const entry = logs.entries.first();
			if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
			if (entry.target?.id !== member.id) return;

			const executorId = entry.executor?.id;
			if (!executorId) return;

			await AntinukeEngine.handle(guild, executorId, 'MEMBER_KICK', {
				targetId: member.id,
				limit: cfg.antiKickLimit,
				interval: cfg.antiKickInterval,
			});
		} catch (e) {
			logger.error('AntiKick', e.message);
		}
	},
};
