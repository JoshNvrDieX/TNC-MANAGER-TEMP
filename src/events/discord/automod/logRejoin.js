/**
 * Rejoin log — fires when a member joins who has joined before.
 * Tracks via a simple in-memory Set per guild (resets on restart).
 * For persistence across restarts, the message_logs table could be used,
 * but for a single-server bot an in-memory Set is perfectly fine.
 */
import { EmbedBuilder } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';

// guildId → Set of userIds seen this session
const seen = new Map();

export default {
	name: 'guildMemberAdd',
	async execute({ eventArgs }) {
		const [member] = eventArgs;
		const { guild, user } = member;
		if (user.bot) return;

		const guildSeen = seen.get(guild.id) ?? new Set();

		if (guildSeen.has(user.id)) {
			// This is a rejoin
			const embed = new EmbedBuilder()
				.setColor(config.colors.success)
				.setAuthor({
					name: user.username,
					iconURL: user.displayAvatarURL(),
				})
				.setDescription(`🔄 <@${user.id}> rejoined the server.`)
				.addFields(
					{ name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
					{ name: 'IDs', value: `> <@${user.id}> (\`${user.id}\`)` }
				)
				.setTimestamp();

			await db.logging?.send(guild, 'rejoinChannel', {
				embeds: [embed],
			}).catch(() => {});
		} else {
			guildSeen.add(user.id);
			seen.set(guild.id, guildSeen);
		}
	},
};
