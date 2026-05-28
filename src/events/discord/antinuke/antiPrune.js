import { AuditLogEvent } from 'discord.js';
import { AntinukeEngine } from '#classes/antinukeEngine';
import { db } from '#dbManager';
import { logger } from '#utils';

export default {
	name: 'guildMembersChunk',
	// We hook into audit logs via a polling approach on guildAuditLogEntryCreate
};

// The real prune detection — fires on audit log entry
export const antiPruneAudit = {
	name: 'guildAuditLogEntryCreate',
	async execute({ eventArgs, client }) {
		const [entry, guild] = eventArgs;
		if (entry.action !== AuditLogEvent.MemberPrune) return;

		const cfg = db.antinuke?.get(guild.id);
		if (!cfg?.enabled || !cfg.antiPruneEnabled) return;

		const executorId = entry.executor?.id;
		if (!executorId) return;

		await AntinukeEngine.handle(guild, executorId, 'MEMBER_PRUNE', {
			targetId: null,
			limitCheck: false, // prune is always instant — one action is enough
		}).catch(e => logger.error('AntiPrune', e.message));
	},
};
