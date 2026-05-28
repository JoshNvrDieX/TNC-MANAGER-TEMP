import { getDb } from '#db/sqlite';
import { CacheManager } from '#utils';

const cache = new CacheManager();

const JSON_FIELDS = ['anti_link_whitelist', 'word_filter_list', 'whitelisted_roles', 'whitelisted_channels'];

const BOOL_FIELDS = [
	'enabled', 'anti_spam_enabled', 'anti_mention_enabled', 'anti_link_enabled',
	'anti_invite_enabled', 'anti_caps_enabled', 'anti_emoji_enabled', 'word_filter_enabled',
];

/** Column name → JS key map for updates */
const COL_MAP = {
	enabled: 'enabled',
	logChannel: 'log_channel',
	antiSpamEnabled: 'anti_spam_enabled',
	antiSpamLimit: 'anti_spam_limit',
	antiSpamInterval: 'anti_spam_interval',
	antiSpamAction: 'anti_spam_action',
	antiSpamMuteDuration: 'anti_spam_mute_duration',
	antiMentionEnabled: 'anti_mention_enabled',
	antiMentionLimit: 'anti_mention_limit',
	antiMentionAction: 'anti_mention_action',
	antiMentionMuteDuration: 'anti_mention_mute_duration',
	antiLinkEnabled: 'anti_link_enabled',
	antiLinkWhitelist: 'anti_link_whitelist',
	antiLinkAction: 'anti_link_action',
	antiLinkMuteDuration: 'anti_link_mute_duration',
	antiInviteEnabled: 'anti_invite_enabled',
	antiInviteAction: 'anti_invite_action',
	antiInviteMuteDuration: 'anti_invite_mute_duration',
	antiCapsEnabled: 'anti_caps_enabled',
	antiCapsThreshold: 'anti_caps_threshold',
	antiCapsMinLength: 'anti_caps_min_length',
	antiCapsAction: 'anti_caps_action',
	antiEmojiEnabled: 'anti_emoji_enabled',
	antiEmojiLimit: 'anti_emoji_limit',
	antiEmojiAction: 'anti_emoji_action',
	wordFilterEnabled: 'word_filter_enabled',
	wordFilterList: 'word_filter_list',
	wordFilterAction: 'word_filter_action',
	wordFilterMuteDuration: 'word_filter_mute_duration',
	whitelistedRoles: 'whitelisted_roles',
	whitelistedChannels: 'whitelisted_channels',
};

export const AutomodSchema = {
	get db() { return getDb(); },

	/** @param {string} guildId @returns {Object} */
	findOrCreate(guildId) {
		let cached = cache.get(guildId);
		if (cached) return cached;

		let row = this.db.prepare('SELECT * FROM automod WHERE guild_id = ?').get(guildId);
		if (!row) {
			this.db.prepare('INSERT OR IGNORE INTO automod (guild_id) VALUES (?)').run(guildId);
			row = this.db.prepare('SELECT * FROM automod WHERE guild_id = ?').get(guildId);
		}
		const data = this._deserialise(row);
		cache.set(guildId, data);
		return data;
	},

	/** @param {string} guildId @returns {Object|null} */
	findById(guildId) {
		const cached = cache.get(guildId);
		if (cached) return cached;

		const row = this.db.prepare('SELECT * FROM automod WHERE guild_id = ?').get(guildId);
		const data = row ? this._deserialise(row) : null;
		if (data) cache.set(guildId, data);
		return data;
	},

	/**
	 * Partial update using camelCase JS keys.
	 * @param {string} guildId
	 * @param {Object} data
	 */
	update(guildId, data) {
		const setClauses = [];
		const values = [];

		for (const [jsKey, col] of Object.entries(COL_MAP)) {
			if (data[jsKey] === undefined) continue;
			setClauses.push(`${col} = ?`);
			const val = data[jsKey];
			if (Array.isArray(val)) values.push(JSON.stringify(val));
			else if (typeof val === 'boolean') values.push(val ? 1 : 0);
			else values.push(val);
		}

		if (setClauses.length === 0) return;
		setClauses.push(`updated_at = datetime('now')`);
		values.push(guildId);

		this.db.prepare(`UPDATE automod SET ${setClauses.join(', ')} WHERE guild_id = ?`).run(...values);
		cache.delete(guildId);
	},

	/** @private */
	_deserialise(row) {
		const out = {};
		for (const [col, val] of Object.entries(row)) {
			// find the JS key for this column
			const jsKey = Object.entries(COL_MAP).find(([, c]) => c === col)?.[0] ?? col;
			if (col === 'guild_id') { out.guildId = val; continue; }
			if (JSON_FIELDS.includes(col)) { out[jsKey] = JSON.parse(val); continue; }
			if (BOOL_FIELDS.includes(col)) { out[jsKey] = val === 1; continue; }
			if (col === 'created_at') { out.createdAt = new Date(val); continue; }
			if (col === 'updated_at') { out.updatedAt = new Date(val); continue; }
			out[jsKey] = val;
		}
		return out;
	},
};
