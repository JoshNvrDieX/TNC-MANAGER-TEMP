/**
 * Handles:
 * - Edit log (stores old content for .editsnipe)
 * - Re-run automod on edited messages
 * - Logging system: message edit
 */
import { EmbedBuilder } from 'discord.js';
import { AutomodEngine } from '#classes/automodEngine';
import { db } from '#dbManager';
import { config } from '#config';

export default {
	name: 'messageUpdate',
	async execute({ eventArgs, client }) {
		const [oldMessage, newMessage] = eventArgs;
		if (!newMessage.guild || !newMessage.author || newMessage.author.bot) return;
		if (oldMessage.content === newMessage.content) return;

		// Edit snipe log
		if (oldMessage.content) {
			db.automodExt?.logMessage(
				newMessage.guild.id, newMessage.channel.id, newMessage.author.id,
				newMessage.content, 'edit', oldMessage.content
			);
		}

		// Re-run automod on edited content
		await AutomodEngine.check(newMessage).catch(() => {});

		const embed = new EmbedBuilder()
			.setColor(config.colors.warn)
			.setAuthor({
				name: newMessage.author.tag,
				iconURL: newMessage.author.displayAvatarURL(),
			})
			.setDescription(`✏️ **Message Edited**\n\n**Before:**\n${(oldMessage.content || '[unknown]').slice(0, 1900)}\n\n**After:**\n${newMessage.content.slice(0, 1900)}`)
			.addFields(
				{
					name: 'Message Date',
					value: `<t:${Math.floor((newMessage.createdTimestamp || Date.now()) / 1000)}:f> (<t:${Math.floor((newMessage.createdTimestamp || Date.now()) / 1000)}:R>)`,
				},
				{
					name: 'IDs',
					value: `> Message (\`${newMessage.id}\`)\n> <#${newMessage.channel.id}> (\`${newMessage.channel.id}\`)\n> <@${newMessage.author.id}> (\`${newMessage.author.id}\`)`,
				}
			)
			.setTimestamp();

		// Logging system
		await db.logging?.send(newMessage.guild, 'messageEditChannel', {
			embeds: [embed],
		}).catch(() => {});
	},
};
