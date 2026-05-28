import { EmbedBuilder } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';

export default {
	name: 'voiceStateUpdate',
	async execute({ eventArgs }) {
		const [oldState, newState] = eventArgs;
		const { guild, member } = newState;
		if (!member || member.user.bot) return;

		let embed = null;

		if (!oldState.channelId && newState.channelId) {
			// Join
			embed = new EmbedBuilder()
				.setColor(config.colors.success)
				.setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
				.setDescription(`📥 <@${member.id}> joined voice channel 🔊 <#${newState.channelId}>.`)
				.addFields({
					name: 'IDs',
					value: `> <@${member.id}> (\`${member.id}\`)\n> 🔊 <#${newState.channelId}> (\`${newState.channelId}\`)`
				})
				.setTimestamp();
		} else if (oldState.channelId && !newState.channelId) {
			// Leave
			embed = new EmbedBuilder()
				.setColor(config.colors.error)
				.setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
				.setDescription(`📤 <@${member.id}> left voice channel 🔊 <#${oldState.channelId}>.`)
				.addFields({
					name: 'IDs',
					value: `> <@${member.id}> (\`${member.id}\`)\n> 🔊 <#${oldState.channelId}> (\`${oldState.channelId}\`)`
				})
				.setTimestamp();
		} else if (oldState.channelId !== newState.channelId) {
			// Move
			embed = new EmbedBuilder()
				.setColor(config.colors.warn)
				.setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
				.setDescription(`🔀 <@${member.id}> moved voice channels.`)
				.addFields(
					{ name: 'Before', value: `🔊 <#${oldState.channelId}>`, inline: true },
					{ name: 'After', value: `🔊 <#${newState.channelId}>`, inline: true },
					{
						name: 'IDs',
						value: `> <@${member.id}> (\`${member.id}\`)\n> Before: <#${oldState.channelId}> (\`${oldState.channelId}\`)\n> After: <#${newState.channelId}> (\`${newState.channelId}\`)`
					}
				)
				.setTimestamp();
		}

		if (embed) await db.logging?.send(guild, 'voiceChannel', { embeds: [embed] }).catch(() => {});
	},
};
