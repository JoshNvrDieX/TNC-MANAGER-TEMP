import { AuditLogEvent } from 'discord.js';
import { AntinukeEngine } from '#classes/antinukeEngine';
import { db } from '#dbManager';
import { logger } from '#utils';

export default {
	name: 'roleDelete',
	async execute({ eventArgs, client }) {
		const [role] = eventArgs;
		const guild = role.guild;
		if (!guild) return;

		const cfg = db.antinuke?.get(guild.id);
		if (!cfg?.enabled || !cfg.antiRoleDeleteEnabled) return;

		const snapshot = {
			id: role.id,
			name: role.name,
			color: role.color,
			hoist: role.hoist,
			position: role.position,
			permissions: role.permissions.bitfield.toString(),
			mentionable: role.mentionable,
		};

		try {
			const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 });
			const entry = logs.entries.first();
			if (!entry || Date.now() - entry.createdTimestamp > 5000) return;

			const executorId = entry.executor?.id;
			if (!executorId) return;

			await AntinukeEngine.handle(guild, executorId, 'ROLE_DELETE', {
				targetId: role.id,
				targetData: snapshot,
				limit: cfg.antiRoleDeleteLimit,
				interval: cfg.antiRoleDeleteInterval,
				recover: async () => {
					await guild.roles.create({
						name: snapshot.name,
						color: snapshot.color,
						hoist: snapshot.hoist,
						permissions: BigInt(snapshot.permissions),
						mentionable: snapshot.mentionable,
						reason: '[Antinuke] Auto-recovery',
					}).catch(() => {});
				},
			});
		} catch (e) {
			logger.error('AntiRoleDelete', e.message);
		}
	},
};
