import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';

export default {
	name: 'webhooksUpdate',
	async execute({ eventArgs }) {
		const [channel] = eventArgs;
		const guild = channel.guild ?? null;
		if (!guild) return;

		let executor = null;
		try {
			const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.WebhookCreate, limit: 1 }).catch(() => null);
			if (logs) {
				const entry = logs.entries.first();
				if (entry && entry.target.channelId === channel.id && entry.createdTimestamp > Date.now() - 5000) {
					executor = entry.executor;
				}
			}
		} catch {}

		const embed = new EmbedBuilder()
			.setColor(config.colors.warn)
			.setAuthor({
				name: executor ? executor.username : guild.name,
				iconURL: executor ? executor.displayAvatarURL() : guild.iconURL() || undefined,
			})
			.setDescription(`🪝 **Webhook Updated/Created**\n<#${channel.id}>`)
			.addFields(
				{
					name: 'IDs',
					value: `> Channel (\`${channel.id}\`)\n> ${executor ? `<@${executor.id}>` : 'Unknown Executor'} (\`${executor?.id ?? 'unknown'}\`)`
				}
			)
			.setTimestamp();

		await db.logging?.send(guild, 'webhookChannel', {
			embeds: [embed],
		}).catch(() => {});
	},
};
