import { AutomodSchema } from '#dbSchema/automod';
import { smartCache } from '#classes/dbCache';

/**
 * Service layer for automod configuration.
 * All reads/writes go through here — no direct schema access from commands/events.
 */
export class AutomodService {
	get(guildId) { return AutomodSchema.findOrCreate(guildId); }

	set(guildId, data) {
		AutomodSchema.findOrCreate(guildId);
		AutomodSchema.update(guildId, data);
		smartCache.invalidate('automod', guildId);
	}

	/** Enable/disable the entire automod system */
	setEnabled(guildId, enabled) { this.set(guildId, { enabled }); }

	/** Set the log channel */
	setLogChannel(guildId, channelId) { this.set(guildId, { logChannel: channelId }); }

	// ── Anti-spam ──────────────────────────────────────────────────────────────
	setAntiSpam(guildId, data) { this.set(guildId, data); }

	// ── Anti-mention ───────────────────────────────────────────────────────────
	setAntiMention(guildId, data) { this.set(guildId, data); }

	// ── Anti-link ──────────────────────────────────────────────────────────────
	setAntiLink(guildId, data) { this.set(guildId, data); }

	// ── Anti-invite ────────────────────────────────────────────────────────────
	setAntiInvite(guildId, data) { this.set(guildId, data); }

	// ── Anti-caps ──────────────────────────────────────────────────────────────
	setAntiCaps(guildId, data) { this.set(guildId, data); }

	// ── Anti-emoji ─────────────────────────────────────────────────────────────
	setAntiEmoji(guildId, data) { this.set(guildId, data); }

	// ── Word filter ────────────────────────────────────────────────────────────
	setWordFilter(guildId, data) { this.set(guildId, data); }

	addWord(guildId, word) {
		const cfg = this.get(guildId);
		const list = cfg.wordFilterList ?? [];
		if (!list.includes(word.toLowerCase())) {
			this.set(guildId, { wordFilterList: [...list, word.toLowerCase()] });
		}
	}

	removeWord(guildId, word) {
		const cfg = this.get(guildId);
		this.set(guildId, { wordFilterList: (cfg.wordFilterList ?? []).filter(w => w !== word.toLowerCase()) });
	}

	// ── Whitelist ──────────────────────────────────────────────────────────────
	addWhitelistedRole(guildId, roleId) {
		const cfg = this.get(guildId);
		const list = cfg.whitelistedRoles ?? [];
		if (!list.includes(roleId)) this.set(guildId, { whitelistedRoles: [...list, roleId] });
	}

	removeWhitelistedRole(guildId, roleId) {
		const cfg = this.get(guildId);
		this.set(guildId, { whitelistedRoles: (cfg.whitelistedRoles ?? []).filter(r => r !== roleId) });
	}

	addWhitelistedChannel(guildId, channelId) {
		const cfg = this.get(guildId);
		const list = cfg.whitelistedChannels ?? [];
		if (!list.includes(channelId)) this.set(guildId, { whitelistedChannels: [...list, channelId] });
	}

	removeWhitelistedChannel(guildId, channelId) {
		const cfg = this.get(guildId);
		this.set(guildId, { whitelistedChannels: (cfg.whitelistedChannels ?? []).filter(c => c !== channelId) });
	}
}
