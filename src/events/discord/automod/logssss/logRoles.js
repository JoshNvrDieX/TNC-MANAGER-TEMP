import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';

export default {
	name: 'roleCreate',
	async execute({ eventArgs }) {
		const [role] = eventArgs;

		let executor = null;
		try {
			const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 }).catch(() => null);
			if (logs) {
				const entry = logs.entries.first();
				if (entry && entry.target.id === role.id && entry.createdTimestamp > Date.now() - 5000) {
					executor = entry.executor;
				}
			}
		} catch {}

		const embed = new EmbedBuilder()
			.setColor(config.colors.success)
			.setAuthor({
				name: executor ? executor.username : role.guild.name,
				iconURL: executor ? executor.displayAvatarURL() : role.guild.iconURL() || undefined,
			})
			.setDescription(`🟢 **Role Created**\n<@&${role.id}> (\`${role.name}\`)`)
			.addFields(
				{
					name: 'IDs',
					value: `> Role (\`${role.id}\`)\n> ${executor ? `<@${executor.id}>` : 'Unknown Executor'} (\`${executor?.id ?? 'unknown'}\`)`
				}
			)
			.setTimestamp();

		await db.logging?.send(role.guild, 'roleChannel', { embeds: [embed] }).catch(() => {});
	},
};
