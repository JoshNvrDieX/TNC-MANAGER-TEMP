import { AuditLogEvent } from 'discord.js';
import { AntinukeEngine } from '#classes/antinukeEngine';
import { db } from '#dbManager';
import { logger } from '#utils';

export default {
	name: 'channelCreate',
	async execute({ eventArgs, client }) {
		const [channel] = eventArgs;
		const guild = channel.guild;
		if (!guild) return;

		const cfg = db.antinuke?.get(guild.id);
		if (!cfg?.enabled || !cfg.antiChannelCreateEnabled) return;

		try {
			const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 1 });
			const entry = logs.entries.first();
			if (!entry || Date.now() - entry.createdTimestamp > 5000) return;

			const executorId = entry.executor?.id;
			if (!executorId) return;

			await AntinukeEngine.handle(guild, executorId, 'CHANNEL_CREATE', {
				targetId: channel.id,
				limit: cfg.antiChannelCreateLimit,
				interval: cfg.antiChannelCreateInterval,
				recover: async () => {
					await channel.delete('[Antinuke] Auto-recovery').catch(() => {});
				},
			});
		} catch (e) {
			logger.error('AntiChannelCreate', e.message);
		}
	},
};
