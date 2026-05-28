import { LoggingSchema } from '#dbSchema/logging';
import { smartCache } from '#classes/dbCache';

export class LoggingService {
	get(guildId) { return LoggingSchema.findOrCreate(guildId); }
	set(guildId, data) {
		LoggingSchema.findOrCreate(guildId);
		LoggingSchema.update(guildId, data);
		smartCache.invalidate('logging', guildId);
	}
	setEnabled(guildId, v) { this.set(guildId, { enabled: v }); }

	async send(guild, type, content) {
		const cfg = smartCache.logging(guild.id) ?? this.get(guild.id);
		if (!cfg?.enabled) return;
		const channelId = cfg[type];
		if (!channelId) return;

		let ch = guild.channels.cache.get(channelId);
		if (!ch) {
			ch = await guild.channels.fetch(channelId).catch(() => null);
		}

		if (!ch?.isTextBased()) return;

		await ch.send(typeof content === 'string' ? { content } : content).catch(e => {
			import('#utils').then(m => m.logger.error('Logging', `Failed to send log to ${channelId} (${type}): ${e.message}`)).catch(() => {});
		});
	}
}
