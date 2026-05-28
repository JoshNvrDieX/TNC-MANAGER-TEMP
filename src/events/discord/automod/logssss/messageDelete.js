/**
 * Handles:
 * - Ghost ping detection
 * - Snipe log (stores deleted message for .snipe command)
 * - Logging system: message delete
 */
import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { AutomodEngine } from '#classes/automodEngine';
import { db } from '#dbManager';
import { config } from '#config';

export default {
	name: 'messageDelete',
	async execute({ eventArgs, client }) {
		const [message] = eventArgs;
		if (!message.guild) return;

		let author = message.author;
		let executor = null;

		if (!author && message.partial) {
			try {
				const full = await message.fetch().catch(() => null);
				author = full?.author ?? null;
			} catch {}
		}

		// Attempt to resolve uncached message author from audit logs
		if (!author && message.guild.members.me?.permissions.has('ViewAuditLog')) {
			try {
				const auditLogs = await message.guild.fetchAuditLogs({
					limit: 1,
					type: AuditLogEvent.MessageDelete,
				});
				const entry = auditLogs.entries.first();

				// Match by channel ID and ensure the entry was created in the last 5 seconds
				if (
					entry &&
					entry.extra.channel.id === message.channel.id &&
					Date.now() - entry.createdTimestamp < 5000
				) {
					author = entry.target;
					executor = entry.executor;
				}
			} catch (e) {
				// Ignore audit log errors
			}
		}

		// Still no author = truly uncached, log what we can
		const isBot = author?.bot ?? false;
		if (isBot) return;

		const content = message.content || '*[Message content was not cached]*';
		const authorId = author?.id ?? message.author?.id ?? 'Unknown';

		// Ghost ping check (only if we have full message data)
		if (author && message.mentions) {
			await AutomodEngine.checkGhostPing(message).catch(() => {});
		}

		// Snipe log
		if (message.content && authorId !== 'unknown') {
			db.automodExt?.logMessage(
				message.guild.id, message.channel.id, authorId,
				message.content, 'delete'
			);
		}

		const embed = new EmbedBuilder()
			.setColor(config.colors.error)
			.setAuthor({
				name: author ? author.tag : 'Uncached User Message',
				iconURL: author?.displayAvatarURL() || undefined,
			})
			.setDescription(`🗑️ **Message Deleted**${executor ? `\n*Deleted by <@${executor.id}>*` : ''}\n\n${content.slice(0, 3900)}`)
			.addFields(
				{
					name: 'Message Date',
					value: `<t:${Math.floor((message.createdTimestamp || Date.now()) / 1000)}:f> (<t:${Math.floor((message.createdTimestamp || Date.now()) / 1000)}:R>)`,
				},
				{
					name: 'IDs',
					value: `> Message (\`${message.id}\`)\n> <#${message.channel.id}> (\`${message.channel.id}\`)\n> ${author ? `<@${author.id}> (\`${authorId}\`)` : `Unknown User (\`${authorId}\`)`}`,
				}
			)
			.setTimestamp();

		await db.logging?.send(message.guild, 'messageDeleteChannel', {
			embeds: [embed],
		}).catch(() => {});
	},
};
