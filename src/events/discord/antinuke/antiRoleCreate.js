import { AuditLogEvent } from 'discord.js';
import { AntinukeEngine } from '#classes/antinukeEngine';
import { db } from '#dbManager';
import { logger } from '#utils';

export default {
	name: 'roleCreate',
	async execute({ eventArgs, client }) {
		const [role] = eventArgs;
		const guild = role.guild;
		if (!guild) return;

		const cfg = db.antinuke?.get(guild.id);
		if (!cfg?.enabled || !cfg.antiRoleCreateEnabled) return;

		try {
			const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 });
			const entry = logs.entries.first();
			if (!entry || Date.now() - entry.createdTimestamp > 5000) return;

			const executorId = entry.executor?.id;
			if (!executorId) return;

			await AntinukeEngine.handle(guild, executorId, 'ROLE_CREATE', {
				targetId: role.id,
				limit: cfg.antiRoleCreateLimit,
				interval: cfg.antiRoleCreateInterval,
				recover: async () => {
					await role.delete('[Antinuke] Auto-recovery').catch(() => {});
				},
			});
		} catch (e) {
			logger.error('AntiRoleCreate', e.message);
		}
	},
};
