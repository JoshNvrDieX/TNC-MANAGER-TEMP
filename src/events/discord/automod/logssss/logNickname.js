import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';

export default {
	name: 'guildMemberUpdate',
	async execute({ eventArgs }) {
		const [oldMember, newMember] = eventArgs;
		if (oldMember.nickname === newMember.nickname) return;

		const oldNick = oldMember.nickname ?? oldMember.user.username;
		const newNick = newMember.nickname ?? newMember.user.username;

		// Try to get who changed it from audit log
		let changedBy = null;
		let executorUser = null;
		try {
			const logs = await newMember.guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 1 });
			const entry = logs.entries.first();
			if (entry && Date.now() - entry.createdTimestamp < 5000 && entry.target.id === newMember.id) {
				changedBy = entry.executor?.id;
				executorUser = entry.executor;
			}
		} catch {}

		const embed = new EmbedBuilder()
			.setColor(config.colors.warn)
			.setAuthor({
				name: executorUser ? executorUser.username : newMember.user.username,
				iconURL: executorUser ? executorUser.displayAvatarURL() : newMember.user.displayAvatarURL(),
			})
			.setDescription(`✏️ **Nickname Changed**\n<@${newMember.id}>`)
			.addFields(
				{ name: 'Before', value: `\`${oldNick}\``, inline: true },
				{ name: 'After', value: `\`${newNick}\``, inline: true },
				{
					name: 'IDs',
					value: `> <@${newMember.id}> (\`${newMember.id}\`)${changedBy && changedBy !== newMember.id ? `\n> Changed By: <@${changedBy}> (\`${changedBy}\`)` : ''}`
				}
			)
			.setTimestamp();

		await db.logging?.send(newMember.guild, 'nicknameChannel', {
			embeds: [embed],
		}).catch(() => {});
	},
};
