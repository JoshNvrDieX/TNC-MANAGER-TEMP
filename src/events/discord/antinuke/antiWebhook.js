import { AuditLogEvent } from 'discord.js';
import { AntinukeEngine } from '#classes/antinukeEngine';
import { db } from '#dbManager';
import { logger } from '#utils';

export default {
	name: 'webhookCreate',
	async execute({ eventArgs, client }) {
		const [webhook] = eventArgs;
		const guild = webhook.guild ?? client.guilds.cache.get(webhook.guildId);
		if (!guild) return;

		const cfg = db.antinuke?.get(guild.id);
		if (!cfg?.enabled || !cfg.antiWebhookEnabled) return;

		try {
			const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.WebhookCreate, limit: 1 });
			const entry = logs.entries.first();
			if (!entry || Date.now() - entry.createdTimestamp > 5000) return;

			const executorId = entry.executor?.id;
			if (!executorId) return;

			await AntinukeEngine.handle(guild, executorId, 'WEBHOOK_CREATE', {
				targetId: webhook.id,
				limit: cfg.antiWebhookLimit,
				interval: cfg.antiWebhookInterval,
				recover: async () => {
					await webhook.delete('[Antinuke] Auto-recovery').catch(() => {});
				},
			});
		} catch (e) {
			logger.error('AntiWebhook', e.message);
		}
	},
};
