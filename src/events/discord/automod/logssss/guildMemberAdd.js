/**
 * On member join:
 * - Account age filter
 * - Username filter
 * - Auto-role on join
 * - Logging: member join
 */
import { EmbedBuilder } from 'discord.js';
import { db } from '#dbManager';
import { logger } from '#utils';
import { config } from '#config';

export default {
	name: 'guildMemberAdd',
	async execute({ eventArgs }) {
		const [member] = eventArgs;
		const { guild, user } = member;

		if (user.bot) {
			// Auto-role for bots
			const ar = db.autorole?.get(guild.id);
			if (ar?.enabled && ar.botRoleIds?.length) {
				for (const roleId of ar.botRoleIds) {
					await member.roles.add(roleId, '[Autorole] Bot join').catch(() => {});
				}
			}
			return;
		}

		const ext = db.automodExt?.get(guild.id);

		// ── Account age filter ─────────────────────────────────────────────────
		if (ext?.accountAgeFilterEnabled) {
			const minDays = ext.accountAgeMinDays ?? 7;
			const ageDays = (Date.now() - user.createdTimestamp) / 86_400_000;
			if (ageDays < minDays) {
				logger.warn('AccountAgeFilter', `${user.tag} age ${Math.floor(ageDays)}d < ${minDays}d`);
				if (ext.accountAgeAction === 'ban' && member.bannable) {
					await member.ban({ reason: `[Automod] Account too new (${Math.floor(ageDays)}d)` }).catch(() => {});
					return;
				}
				if (member.kickable) {
					await member.kick(`[Automod] Account too new (${Math.floor(ageDays)}d)`).catch(() => {});
					return;
				}
			}
		}

		// ── Username filter ────────────────────────────────────────────────────
		if (ext?.usernameFilterEnabled) {
			const list = ext.usernameFilterList ?? [];
			const lower = user.username.toLowerCase();
			if (list.some(w => lower.includes(w))) {
				if (ext.usernameFilterAction === 'ban' && member.bannable) {
					await member.ban({ reason: '[Automod] Username filter' }).catch(() => {});
					return;
				}
				if (member.kickable) {
					await member.kick('[Automod] Username filter').catch(() => {});
					return;
				}
			}
		}

		// ── Auto-role on join ──────────────────────────────────────────────────
		const ar = db.autorole?.get(guild.id);
		if (ar?.enabled && ar.roleIds?.length) {
			for (const roleId of ar.roleIds) {
				await member.roles.add(roleId, '[Autorole] Member join').catch(() => {});
			}
		}

		const embed = new EmbedBuilder()
			.setColor(config.colors.success)
			.setAuthor({
				name: user.username,
				iconURL: user.displayAvatarURL(),
			})
			.setDescription(`📥 <@${user.id}> joined the server.`)
			.addFields(
				{ name: 'Account Age', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
				{ name: 'Member Count', value: `${guild.memberCount}`, inline: true },
				{ name: 'IDs', value: `> <@${user.id}> (\`${user.id}\`)` }
			)
			.setTimestamp();

		// ── Logging ────────────────────────────────────────────────────────────
		await db.logging?.send(guild, 'memberJoinChannel', { embeds: [embed] }).catch(() => {});
	},
};
