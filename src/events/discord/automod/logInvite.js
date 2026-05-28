import { EmbedBuilder } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';

export default {
	name: 'inviteCreate',
	async execute({ eventArgs }) {
		const [invite] = eventArgs;

		const embed = new EmbedBuilder()
			.setColor(config.colors.success)
			.setAuthor({
				name: invite.inviter ? invite.inviter.username : 'Unknown User',
				iconURL: invite.inviter ? invite.inviter.displayAvatarURL() : undefined,
			})
			.setDescription(`📨 **Invite Created**\n\`${invite.code}\``)
			.addFields(
				{ name: 'Channel', value: invite.channel ? `<#${invite.channel.id}>` : 'Unknown', inline: true },
				{
					name: 'IDs',
					value: `> Invite Code (\`${invite.code}\`)\n> ${invite.inviter ? `<@${invite.inviter.id}>` : 'Unknown Inviter'} (\`${invite.inviter?.id ?? 'unknown'}\`)`
				}
			)
			.setTimestamp();

		await db.logging?.send(invite.guild, 'inviteChannel', {
			embeds: [embed],
		}).catch(() => {});
	},
};
