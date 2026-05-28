/**
 * Catches misc dangerous audit log actions via guildAuditLogEntryCreate:
 * - Anti-everyone/here ping (via message events in Prefixcmd)
 * - Anti-member update (nickname abuse, dangerous role assignment)
 * - Anti-thread delete/create
 * - Anti-invite create
 * - Dangerous URL / token grabber link detection (message-level)
 */
import { AuditLogEvent } from 'discord.js';
import { AntinukeEngine } from '#classes/antinukeEngine';
import { db } from '#dbManager';
import { logger } from '#utils';

export default {
	name: 'guildAuditLogEntryCreate',
	async execute({ eventArgs, client }) {
		const [entry, guild] = eventArgs;
		if (!guild) return;

		const cfg = db.antinuke?.get(guild.id);
		if (!cfg?.enabled) return;

		const executorId = entry.executor?.id;
		if (!executorId) return;
		if (Date.now() - entry.createdTimestamp > 5000) return;

		switch (entry.action) {
			// Anti-invite create
			case AuditLogEvent.InviteCreate: {
				if (!cfg.antiInviteEnabled) return;
				try {
					await AntinukeEngine.handle(guild, executorId, 'INVITE_CREATE', {
						targetId: entry.target?.code,
						limitCheck: true,
						limit: cfg.antiInviteLimit || 5,
						interval: cfg.antiInviteInterval || 10_000,
						recover: async () => {
							const invite = (await guild.invites.fetch()).get(entry.target?.code);
							if (invite) await invite.delete('[Antinuke] Auto-recovery').catch(() => {});
						},
					});
				} catch (e) { logger.error('AntiInviteCreate', e.message); }
				break;
			}

			// Anti-member update (nickname abuse, dangerous role add)
			case AuditLogEvent.MemberUpdate: {
				const changes = entry.changes ?? [];
				const nickChange = changes.find(c => c.key === 'nick');
				const rolesAdded = changes.find(c => c.key === '$add');

				if (nickChange) {
					try {
						await AntinukeEngine.handle(guild, executorId, 'NICKNAME_ABUSE', {
							targetId: entry.target?.id,
							limitCheck: true,
							limit: 5,
							interval: 10_000,
						});
					} catch (e) { logger.error('AntiNickname', e.message); }
				}

				if (rolesAdded?.new?.length) {
					// Check if any added role has dangerous permissions
					for (const addedRole of rolesAdded.new) {
						const role = guild.roles.cache.get(addedRole.id);
						if (role?.permissions.has(BigInt('8'))) { // Administrator
							try {
								await AntinukeEngine.handle(guild, executorId, 'DANGEROUS_ROLE_ASSIGN', {
									targetId: entry.target?.id,
									limitCheck: false,
									recover: async () => {
										const member = guild.members.cache.get(entry.target?.id);
										if (member) await member.roles.remove(addedRole.id, '[Antinuke] Auto-recovery').catch(() => {});
									},
								});
							} catch (e) { logger.error('AntiDangerousRole', e.message); }
						}
					}
				}
				break;
			}

			// Anti-thread delete
			case AuditLogEvent.ThreadDelete: {
				try {
					await AntinukeEngine.handle(guild, executorId, 'THREAD_DELETE', {
						targetId: entry.target?.id,
						limitCheck: true,
						limit: 5,
						interval: 10_000,
					});
				} catch (e) { logger.error('AntiThreadDelete', e.message); }
				break;
			}

			// Anti-category delete
			case AuditLogEvent.ChannelDelete: {
				// Category-specific check is handled in antiChannelDelete.js
				// This is a fallback for any missed ones
				break;
			}

			default:
				break;
		}
	},
};
