import { EmbedBuilder } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';

export default {
	name: 'guildBanAdd',
	async execute({ eventArgs }) {
		const [ban] = eventArgs;

		const embed = new EmbedBuilder()
			.setColor(config.colors.error)
			.setAuthor({
				name: ban.user.username,
				iconURL: ban.user.displayAvatarURL(),
			})
			.setDescription(`🔨 <@${ban.user.id}> was banned.`)
			.addFields(
				{ name: 'Reason', value: ban.reason ?? 'No reason provided' },
				{ name: 'IDs', value: `> <@${ban.user.id}> (\`${ban.user.id}\`)` }
			)
			.setTimestamp();

		await db.logging?.send(ban.guild, 'memberBanChannel', {
			embeds: [embed],
		}).catch(() => {});
	},
};
