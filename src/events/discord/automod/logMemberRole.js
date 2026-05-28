import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';

export default {
	name: 'guildMemberUpdate',
	async execute({ eventArgs }) {
		const [oldMember, newMember] = eventArgs;

		const oldRoles = new Set(oldMember.roles.cache.keys());
		const newRoles = new Set(newMember.roles.cache.keys());

		const added = [...newRoles].filter(id => !oldRoles.has(id));
		const removed = [...oldRoles].filter(id => !newRoles.has(id));

		if (!added.length && !removed.length) return;

		let executor = null;
		try {
			const logs = await newMember.guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 1 }).catch(() => null);
			if (logs) {
				const entry = logs.entries.first();
				if (entry && entry.target.id === newMember.id && entry.createdTimestamp > Date.now() - 5000) {
					executor = entry.executor;
				}
			}
		} catch {}

		const embed = new EmbedBuilder()
			.setColor(added.length ? config.colors.success : config.colors.error)
			.setAuthor({
				name: executor ? executor.username : newMember.user.username,
				iconURL: executor ? executor.displayAvatarURL() : newMember.user.displayAvatarURL(),
			})
			.setDescription(`**Roles ${added.length && removed.length ? 'Updated' : added.length ? 'Given' : 'Removed'}**\n${added.length ? `+ ${added.map(id => `<@&${id}>`).join(' ')}\n` : ''}${removed.length ? `- ${removed.map(id => `<@&${id}>`).join(' ')}` : ''}`)
			.addFields(
				{
					name: 'IDs',
					value: `> ${executor ? `<@${executor.id}>` : 'Unknown Executor'} (\`${executor?.id ?? 'unknown'}\`)\n> <@${newMember.id}> (\`${newMember.id}\`)`
				}
			)
			.setTimestamp();

		await db.logging?.send(newMember.guild, 'memberRoleChannel', {
			embeds: [embed],
		}).catch(() => {});

		// Autorole log
		if (added.length) {
			const arEmbed = new EmbedBuilder()
				.setColor(config.colors.success)
				.setAuthor({
					name: newMember.user.username,
					iconURL: newMember.user.displayAvatarURL(),
				})
				.setDescription(`🎭 **Auto-Role Assigned**\n+ ${added.map(id => `<@&${id}>`).join(' ')}`)
				.addFields(
					{
						name: 'IDs',
						value: `> <@${newMember.id}> (\`${newMember.id}\`)`
					}
				)
				.setTimestamp();

			await db.logging?.send(newMember.guild, 'autoroleChannel', {
				embeds: [arEmbed],
			}).catch(() => {});
		}
	},
};
