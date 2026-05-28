import { EmbedBuilder } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';

export default {
	name: 'guildMemberRemove',
	async execute({ eventArgs, client }) {
		const [member] = eventArgs;
		const { guild, user } = member;
		if (user.bot) return;

		const embed = new EmbedBuilder()
			.setColor(config.colors.error)
			.setAuthor({
				name: user.username,
				iconURL: user.displayAvatarURL(),
			})
			.setDescription(`📤 <@${user.id}> left the server.`)
			.addFields(
				{ name: 'Joined', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
				{ name: 'Member Count', value: `${guild.memberCount}`, inline: true },
				{ name: 'IDs', value: `> <@${user.id}> (\`${user.id}\`)` }
			)
			.setTimestamp();

		// Logging
		await db.logging?.send(guild, 'memberLeaveChannel', {
			embeds: [embed],
		}).catch(() => {});
	},
};
