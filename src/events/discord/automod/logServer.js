import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';

export default {
	name: 'guildUpdate',
	async execute({ eventArgs }) {
		const [oldGuild, newGuild] = eventArgs;

		const changes = [];
		if (oldGuild.name !== newGuild.name) changes.push(`**Name:** \`${oldGuild.name}\` → \`${newGuild.name}\``);
		if (oldGuild.verificationLevel !== newGuild.verificationLevel) changes.push(`**Verification Level:** \`${oldGuild.verificationLevel}\` → \`${newGuild.verificationLevel}\``);
		if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) changes.push(`**Content Filter:** \`${oldGuild.explicitContentFilter}\` → \`${newGuild.explicitContentFilter}\``);
		if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) changes.push(`**Vanity URL:** \`${oldGuild.vanityURLCode ?? 'none'}\` → \`${newGuild.vanityURLCode ?? 'none'}\``);
		if (oldGuild.afkChannelId !== newGuild.afkChannelId) changes.push(`**AFK Channel:** changed`);
		if (oldGuild.systemChannelId !== newGuild.systemChannelId) changes.push(`**System Channel:** changed`);

		if (!changes.length) return;

		let executor = null;
		try {
			const logs = await newGuild.fetchAuditLogs({ type: AuditLogEvent.GuildUpdate, limit: 1 }).catch(() => null);
			if (logs) {
				const entry = logs.entries.first();
				if (entry && entry.target.id === newGuild.id && entry.createdTimestamp > Date.now() - 5000) {
					executor = entry.executor;
				}
			}
		} catch {}

		const embed = new EmbedBuilder()
			.setColor(config.colors.warn)
			.setAuthor({
				name: executor ? executor.username : newGuild.name,
				iconURL: executor ? executor.displayAvatarURL() : newGuild.iconURL() || undefined,
			})
			.setDescription(`⚙️ **Server Updated**\n\n${changes.join('\n')}`)
			.addFields(
				{
					name: 'IDs',
					value: `> Server (\`${newGuild.id}\`)\n> ${executor ? `<@${executor.id}>` : 'Unknown Executor'} (\`${executor?.id ?? 'unknown'}\`)`
				}
			)
			.setTimestamp();

		await db.logging?.send(newGuild, 'serverChannel', {
			embeds: [embed],
		}).catch(() => {});
	},
};
