import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import { AntinukeEngine } from '#classes/antinukeEngine';
import { db } from '#dbManager';
import { logger } from '#utils';

const DANGEROUS_PERMS = [
	PermissionFlagsBits.Administrator,
	PermissionFlagsBits.ManageGuild,
	PermissionFlagsBits.ManageChannels,
	PermissionFlagsBits.ManageRoles,
	PermissionFlagsBits.BanMembers,
	PermissionFlagsBits.KickMembers,
	PermissionFlagsBits.ManageWebhooks,
	PermissionFlagsBits.MentionEveryone,
];

export default {
	name: 'roleUpdate',
	async execute({ eventArgs, client }) {
		const [oldRole, newRole] = eventArgs;
		const guild = newRole.guild;
		if (!guild) return;

		const cfg = db.antinuke?.get(guild.id);
		if (!cfg?.enabled || !cfg.antiRoleUpdateEnabled) return;

		// Only care if dangerous permissions were added
		const addedDangerous = DANGEROUS_PERMS.some(p =>
			!oldRole.permissions.has(p) && newRole.permissions.has(p)
		);
		if (!addedDangerous) return;

		try {
			const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleUpdate, limit: 1 });
			const entry = logs.entries.first();
			if (!entry || Date.now() - entry.createdTimestamp > 5000) return;

			const executorId = entry.executor?.id;
			if (!executorId) return;

			await AntinukeEngine.handle(guild, executorId, 'ROLE_UPDATE_DANGEROUS_PERMS', {
				targetId: newRole.id,
				targetData: { roleName: newRole.name },
				limit: cfg.antiRoleUpdateLimit,
				interval: cfg.antiRoleUpdateInterval,
				recover: async () => {
					// Revert permissions to what they were before
					await newRole.setPermissions(oldRole.permissions, '[Antinuke] Auto-recovery').catch(() => {});
				},
			});
		} catch (e) {
			logger.error('AntiRoleUpdate', e.message);
		}
	},
};
