import { EmbedBuilder } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';

export default {
	name: 'guildBanRemove',
	async execute({ eventArgs }) {
		const [ban] = eventArgs;

		const embed = new EmbedBuilder()
			.setColor(config.colors.success)
			.setAuthor({
				name: ban.user.username,
				iconURL: ban.user.displayAvatarURL(),
			})
			.setDescription(`🔓 <@${ban.user.id}> was unbanned.`)
			.addFields(
				{ name: 'IDs', value: `> <@${ban.user.id}> (\`${ban.user.id}\`)` }
			)
			.setTimestamp();

		await db.logging?.send(ban.guild, 'memberUnbanChannel', {
			embeds: [embed],
		}).catch(() => {});
	},
};
