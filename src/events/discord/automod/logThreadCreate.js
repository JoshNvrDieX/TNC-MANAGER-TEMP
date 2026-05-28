import { EmbedBuilder } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';

export default {
	name: 'threadCreate',
	async execute({ eventArgs }) {
		const [thread] = eventArgs;
		if (!thread.guild) return;

		let ownerUser = null;
		try {
			if (thread.ownerId) {
				const member = await thread.guild.members.fetch(thread.ownerId).catch(() => null);
				if (member) ownerUser = member.user;
			}
		} catch {}

		const embed = new EmbedBuilder()
			.setColor(config.colors.success)
			.setAuthor({
				name: ownerUser ? ownerUser.username : thread.guild.name,
				iconURL: ownerUser ? ownerUser.displayAvatarURL() : thread.guild.iconURL() || undefined,
			})
			.setDescription(`🧵 **Thread Created**\n<#${thread.id}>`)
			.addFields(
				{ name: 'Parent Channel', value: `<#${thread.parentId}>`, inline: true },
				{
					name: 'IDs',
					value: `> Thread (\`${thread.id}\`)\n> Parent (\`${thread.parentId}\`)\n> ${ownerUser ? `<@${thread.ownerId}>` : 'Unknown Creator'} (\`${thread.ownerId ?? 'unknown'}\`)`
				}
			)
			.setTimestamp();

		await db.logging?.send(thread.guild, 'threadChannel', {
			embeds: [embed],
		}).catch(() => {});
	},
};
