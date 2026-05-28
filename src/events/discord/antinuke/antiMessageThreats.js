/**
 * Message-level antinuke checks:
 * - Anti @everyone / @here ping
 * - Dangerous URL / token grabber link detection
 */
import { PermissionFlagsBits } from 'discord.js';
import { AntinukeEngine } from '#classes/antinukeEngine';
import { db } from '#dbManager';
import { logger } from '#utils';

export default {
	name: 'messageCreate',
	async execute({ eventArgs, client }) {
		const [message] = eventArgs;
		if (!message.guild || message.author?.bot) return;

		const cfg = db.antinuke?.get(message.guild.id);
		if (!cfg?.enabled) return;

		// Bypass trusted users
		if (AntinukeEngine.isTrusted(message.guild, message.author.id, cfg)) return;

		// Anti-everyone/here ping
		if (cfg.antiEveryoneEnabled && (message.mentions.everyone)) {
			// Only flag if the user doesn't legitimately have MentionEveryone
			const member = message.member;
			if (!member?.permissions.has(PermissionFlagsBits.MentionEveryone)) {
				await message.delete().catch(() => {});
				await AntinukeEngine.alert(message.guild, message.author.id, 'EVERYONE_PING', cfg, null);
				logger.warn('AntiEveryone', `Blocked @everyone ping by ${message.author.tag}`);
				return;
			}
		}

		// Dangerous URL / token grabber detection
		if (AntinukeEngine.hasDangerousUrl(message.content)) {
			await message.delete().catch(() => {});
			await AntinukeEngine.alert(message.guild, message.author.id, 'DANGEROUS_URL', cfg, null);

			// Also punish — token grabbers are instant ban territory
			await AntinukeEngine.punish(message.guild, message.author.id, cfg, 'Dangerous URL / Token Grabber');
			logger.warn('AntiDangerousURL', `Blocked dangerous URL from ${message.author.tag}`);
		}
	},
};
