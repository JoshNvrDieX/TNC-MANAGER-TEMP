import { AuditLogEvent } from 'discord.js';
import { AntinukeEngine } from '#classes/antinukeEngine';
import { db } from '#dbManager';
import { logger } from '#utils';

export default {
	name: 'guildMemberAdd',
	async execute({ eventArgs, client }) {
		const [member] = eventArgs;
		if (!member.user.bot) return;

		const guild = member.guild;
		const cfg = db.antinuke?.get(guild.id);
		if (!cfg?.enabled || !cfg.antiBotEnabled) return;

		// Whitelisted bots bypass
		if ((cfg.whitelistedBots ?? []).includes(member.id)) return;

		try {
			const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 1 });
			const entry = logs.entries.first();
			if (!entry || Date.now() - entry.createdTimestamp > 5000) return;

			const executorId = entry.executor?.id;
			if (!executorId) return;

			await AntinukeEngine.handle(guild, executorId, 'BOT_ADD', {
				targetId: member.id,
				limit: cfg.antiBotLimit,
				interval: cfg.antiBotInterval,
				recover: async () => {
					await guild.members.kick(member.id, '[Antinuke] Unauthorized bot').catch(() => {});
				},
			});
		} catch (e) {
			logger.error('AntiBotAdd', e.message);
		}
	},
};
