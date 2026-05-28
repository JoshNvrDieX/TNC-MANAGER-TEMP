import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';

export default {
	name: 'channelCreate',
	async execute({ eventArgs }) {
		const [channel] = eventArgs;
		if (!channel.guild) return;

		let executor = null;
		try {
			const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 1 }).catch(() => null);
			if (logs) {
				const entry = logs.entries.first();
				if (entry && entry.target.id === channel.id && entry.createdTimestamp > Date.now() - 5000) {
					executor = entry.executor;
				}
			}
		} catch {}

		const embed = new EmbedBuilder()
			.setColor(config.colors.success)
			.setAuthor({
				name: executor ? executor.username : channel.guild.name,
				iconURL: executor ? executor.displayAvatarURL() : channel.guild.iconURL() || undefined,
			})
			.setDescription(`🟢 **Channel Created**\n<#${channel.id}>`)
			.addFields(
				{
					name: 'IDs',
					value: `> Channel (\`${channel.id}\`)\n> ${executor ? `<@${executor.id}>` : 'Unknown Executor'} (\`${executor?.id ?? 'unknown'}\`)`
				}
			)
			.setTimestamp();

		await db.logging?.send(channel.guild, 'channelChannel', { embeds: [embed] }).catch(() => {});
	},
};
