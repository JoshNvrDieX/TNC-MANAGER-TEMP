import { AuditLogEvent } from 'discord.js';
import { AntinukeEngine } from '#classes/antinukeEngine';
import { db } from '#dbManager';
import { logger } from '#utils';

export default {
	name: 'emojiDelete',
	async execute({ eventArgs, client }) {
		const [emoji] = eventArgs;
		const guild = emoji.guild;
		if (!guild) return;

		const cfg = db.antinuke?.get(guild.id);
		if (!cfg?.enabled || !cfg.antiEmojiDeleteEnabled) return;

		try {
			const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.EmojiDelete, limit: 1 });
			const entry = logs.entries.first();
			if (!entry || Date.now() - entry.createdTimestamp > 5000) return;

			const executorId = entry.executor?.id;
			if (!executorId) return;

			await AntinukeEngine.handle(guild, executorId, 'EMOJI_DELETE', {
				targetId: emoji.id,
				targetData: { name: emoji.name },
				limit: cfg.antiEmojiDeleteLimit,
				interval: cfg.antiEmojiDeleteInterval,
			});
		} catch (e) {
			logger.error('AntiEmojiDelete', e.message);
		}
	},
};
