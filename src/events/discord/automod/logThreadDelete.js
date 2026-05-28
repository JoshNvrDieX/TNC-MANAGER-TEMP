import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';

export default {
	name: 'threadDelete',
	async execute({ eventArgs }) {
		const [thread] = eventArgs;
		if (!thread.guild) return;

		let executor = null;
		try {
			const logs = await thread.guild.fetchAuditLogs({ type: AuditLogEvent.ThreadDelete, limit: 1 }).catch(() => null);
			if (logs) {
				const entry = logs.entries.first();
				if (entry && entry.target.id === thread.id && entry.createdTimestamp > Date.now() - 5000) {
					executor = entry.executor;
				}
			}
		} catch {}

		const embed = new EmbedBuilder()
			.setColor(config.colors.error)
			.setAuthor({
				name: executor ? executor.username : thread.guild.name,
				iconURL: executor ? executor.displayAvatarURL() : thread.guild.iconURL() || undefined,
			})
			.setDescription(`🗑️ **Thread Deleted**\n\`${thread.name}\``)
			.addFields(
				{ name: 'Parent Channel', value: `<#${thread.parentId}>`, inline: true },
				{
					name: 'IDs',
					value: `> Thread (\`${thread.id}\`)\n> Parent (\`${thread.parentId}\`)\n> ${executor ? `<@${executor.id}>` : 'Unknown Executor'} (\`${executor?.id ?? 'unknown'}\`)`
				}
			)
			.setTimestamp();

		await db.logging?.send(thread.guild, 'threadChannel', {
			embeds: [embed],
		}).catch(() => {});
	},
};
