import { getDb } from '#db/sqlite';
import { CacheManager } from '#utils';

const cache = new CacheManager();

const BOOL_FIELDS = ['enabled'];

export const COL_MAP = {
	enabled: 'enabled',
	setupCategoryId: 'setup_category_id',
	// Message
	messageDeleteChannel: 'message_delete_channel',
	messageEditChannel: 'message_edit_channel',
	// Members
	memberJoinChannel: 'member_join_channel',
	memberLeaveChannel: 'member_leave_channel',
	memberBanChannel: 'member_ban_channel',
	memberUnbanChannel: 'member_unban_channel',
	memberRoleChannel: 'member_role_channel',
	nicknameChannel: 'nickname_channel',
	rejoinChannel: 'rejoin_channel',
	// Roles
	roleChannel: 'role_channel',
	// Channels
	channelChannel: 'channel_channel',
	// Voice
	voiceChannel: 'voice_channel',
	// Server
	serverChannel: 'server_channel',
	// Threads
	threadChannel: 'thread_channel',
	// Webhooks
	webhookChannel: 'webhook_channel',
	// Invites
	inviteChannel: 'invite_channel',
	// Mod actions
	modChannel: 'mod_channel',
	// Bot commands
	botCommandsChannel: 'bot_commands_channel',
	// Autorole
	autoroleChannel: 'autorole_channel',
	// Automod
	automodChannel: 'automod_channel',
};

export const LoggingSchema = {
	get db() { return getDb(); },

	findOrCreate(guildId) {
		let cached = cache.get(guildId);
		if (cached) return cached;

		let row = this.db.prepare('SELECT * FROM logging WHERE guild_id = ?').get(guildId);
		if (!row) {
			this.db.prepare('INSERT OR IGNORE INTO logging (guild_id) VALUES (?)').run(guildId);
			row = this.db.prepare('SELECT * FROM logging WHERE guild_id = ?').get(guildId);
		}
		const data = this._des(row);
		cache.set(guildId, data);
		return data;
	},

	update(guildId, data) {
		const setClauses = [];
		const values = [];
		for (const [jsKey, col] of Object.entries(COL_MAP)) {
			if (data[jsKey] === undefined) continue;
			setClauses.push(`${col} = ?`);
			const v = data[jsKey];
			values.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
		}
		if (!setClauses.length) return;
		setClauses.push(`updated_at = datetime('now')`);
		values.push(guildId);
		this.db.prepare(`UPDATE logging SET ${setClauses.join(', ')} WHERE guild_id = ?`).run(...values);
		cache.delete(guildId);
	},

	/** @private */
	_des(row) {
		const out = {};
		for (const [col, val] of Object.entries(row)) {
			if (col === 'guild_id') { out.guildId = val; continue; }
			const jsKey = Object.entries(COL_MAP).find(([, c]) => c === col)?.[0] ?? col;
			if (BOOL_FIELDS.includes(col)) { out[jsKey] = val === 1; continue; }
			if (col === 'created_at') { out.createdAt = new Date(val); continue; }
			if (col === 'updated_at') { out.updatedAt = new Date(val); continue; }
			out[jsKey] = val;
		}
		return out;
	},
};
