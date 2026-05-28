import { getDb } from '#db/sqlite';
import { CacheManager } from '#utils';

const cache = new CacheManager();

const BOOL_FIELDS = [
	'anti_ghost_ping_enabled', 'anti_zalgo_enabled', 'anti_scam_enabled',
	'media_filter_enabled', 'auto_slowmode_enabled',
	'username_filter_enabled', 'account_age_filter_enabled',
];
const JSON_FIELDS = ['media_filter_blocked_types', 'username_filter_list'];

export const COL_MAP_EXT = {
	antiGhostPingEnabled: 'anti_ghost_ping_enabled',
	antiGhostPingAction: 'anti_ghost_ping_action',
	antiZalgoEnabled: 'anti_zalgo_enabled',
	antiZalgoAction: 'anti_zalgo_action',
	antiScamEnabled: 'anti_scam_enabled',
	antiScamAction: 'anti_scam_action',
	mediaFilterEnabled: 'media_filter_enabled',
	mediaFilterBlockedTypes: 'media_filter_blocked_types',
	mediaFilterAction: 'media_filter_action',
	autoSlowmodeEnabled: 'auto_slowmode_enabled',
	autoSlowmodeThreshold: 'auto_slowmode_threshold',
	autoSlowmodeInterval: 'auto_slowmode_interval',
	autoSlowmodeDuration: 'auto_slowmode_duration',
	warnMuteThreshold: 'warn_mute_threshold',
	warnKickThreshold: 'warn_kick_threshold',
	warnBanThreshold: 'warn_ban_threshold',
	warnMuteDuration: 'warn_mute_duration',
	usernameFilterEnabled: 'username_filter_enabled',
	usernameFilterList: 'username_filter_list',
	usernameFilterAction: 'username_filter_action',
	accountAgeFilterEnabled: 'account_age_filter_enabled',
	accountAgeMinDays: 'account_age_min_days',
	accountAgeAction: 'account_age_action',
};

export const AutomodExtSchema = {
	get db() { return getDb(); },

	findOrCreate(guildId) {
		let cached = cache.get(guildId);
		if (cached) return cached;

		let row = this.db.prepare('SELECT * FROM automod_ext WHERE guild_id = ?').get(guildId);
		if (!row) {
			this.db.prepare('INSERT OR IGNORE INTO automod_ext (guild_id) VALUES (?)').run(guildId);
			row = this.db.prepare('SELECT * FROM automod_ext WHERE guild_id = ?').get(guildId);
		}
		const data = this._des(row);
		cache.set(guildId, data);
		return data;
	},

	update(guildId, data) {
		const setClauses = [];
		const values = [];
		for (const [jsKey, col] of Object.entries(COL_MAP_EXT)) {
			if (data[jsKey] === undefined) continue;
			setClauses.push(`${col} = ?`);
			const v = data[jsKey];
			if (Array.isArray(v)) values.push(JSON.stringify(v));
			else if (typeof v === 'boolean') values.push(v ? 1 : 0);
			else values.push(v);
		}
		if (!setClauses.length) return;
		setClauses.push(`updated_at = datetime('now')`);
		values.push(guildId);
		this.db.prepare(`UPDATE automod_ext SET ${setClauses.join(', ')} WHERE guild_id = ?`).run(...values);
		cache.delete(guildId);
	},

	// ── Warning helpers ────────────────────────────────────────────────────────
	addWarning(guildId, userId, moderatorId, reason) {
		this.db.prepare(
			`INSERT INTO automod_warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)`
		).run(guildId, userId, moderatorId, reason);
		return this.getWarningCount(guildId, userId);
	},

	getWarningCount(guildId, userId) {
		return this.db.prepare(
			'SELECT COUNT(*) as cnt FROM automod_warnings WHERE guild_id = ? AND user_id = ?'
		).get(guildId, userId)?.cnt ?? 0;
	},

	getWarnings(guildId, userId) {
		return this.db.prepare(
			'SELECT * FROM automod_warnings WHERE guild_id = ? AND user_id = ? ORDER BY id DESC'
		).all(guildId, userId);
	},

	clearWarnings(guildId, userId) {
		this.db.prepare('DELETE FROM automod_warnings WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
	},

	removeWarning(guildId, warnId) {
		this.db.prepare('DELETE FROM automod_warnings WHERE id = ? AND guild_id = ?').run(warnId, guildId);
	},

	// ── Message log helpers ────────────────────────────────────────────────────
	logMessage(guildId, channelId, userId, content, type, oldContent = null) {
		this.db.prepare(
			`INSERT INTO message_logs (guild_id, channel_id, user_id, content, type, old_content) VALUES (?, ?, ?, ?, ?, ?)`
		).run(guildId, channelId, userId, content.slice(0, 2000), type, oldContent?.slice(0, 2000) ?? null);
		// Keep only last 100 per guild
		this.db.prepare(
			`DELETE FROM message_logs WHERE guild_id = ? AND id NOT IN (SELECT id FROM message_logs WHERE guild_id = ? ORDER BY id DESC LIMIT 100)`
		).run(guildId, guildId);
	},

	getLastDeleted(guildId, channelId, limit = 1) {
		return this.db.prepare(
			`SELECT * FROM message_logs WHERE guild_id = ? AND channel_id = ? AND type = 'delete' ORDER BY id DESC LIMIT ?`
		).all(guildId, channelId, limit);
	},

	getLastEdited(guildId, channelId, limit = 1) {
		return this.db.prepare(
			`SELECT * FROM message_logs WHERE guild_id = ? AND channel_id = ? AND type = 'edit' ORDER BY id DESC LIMIT ?`
		).all(guildId, channelId, limit);
	},

	/** @private */
	_des(row) {
		const out = {};
		for (const [col, val] of Object.entries(row)) {
			if (col === 'guild_id') { out.guildId = val; continue; }
			const jsKey = Object.entries(COL_MAP_EXT).find(([, c]) => c === col)?.[0] ?? col;
			if (JSON_FIELDS.includes(col)) { out[jsKey] = JSON.parse(val); continue; }
			if (BOOL_FIELDS.includes(col)) { out[jsKey] = val === 1; continue; }
			if (col === 'created_at') { out.createdAt = new Date(val); continue; }
			if (col === 'updated_at') { out.updatedAt = new Date(val); continue; }
			out[jsKey] = val;
		}
		return out;
	},
};
