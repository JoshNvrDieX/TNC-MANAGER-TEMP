import { getDb } from '#db/sqlite';
import { CacheManager } from '#utils';

const cache = new CacheManager();

const JSON_FIELDS = ['owner_ids', 'trusted_admins', 'whitelisted_bots'];
const BOOL_FIELDS = [
	'enabled', 'auto_recovery',
	'anti_ban_enabled', 'anti_kick_enabled',
	'anti_channel_delete_enabled', 'anti_channel_create_enabled',
	'anti_role_delete_enabled', 'anti_role_create_enabled', 'anti_role_update_enabled',
	'anti_webhook_enabled', 'anti_bot_enabled', 'anti_prune_enabled',
	'anti_everyone_enabled', 'anti_guild_update_enabled',
	'anti_emoji_delete_enabled', 'anti_vanity_enabled',
	'lockdown_enabled', 'anti_invite_enabled',
];

/** camelCase JS key → SQLite column name */
export const COL_MAP = {
	enabled: 'enabled',
	logChannel: 'log_channel',
	alertChannel: 'alert_channel',
	punishmentType: 'punishment_type',
	autoRecovery: 'auto_recovery',
	quarantineRole: 'quarantine_role',
	ownerIds: 'owner_ids',
	trustedAdmins: 'trusted_admins',
	whitelistedBots: 'whitelisted_bots',
	antiBanEnabled: 'anti_ban_enabled',
	antiBanLimit: 'anti_ban_limit',
	antiBanInterval: 'anti_ban_interval',
	antiKickEnabled: 'anti_kick_enabled',
	antiKickLimit: 'anti_kick_limit',
	antiKickInterval: 'anti_kick_interval',
	antiInviteEnabled: 'anti_invite_enabled',
	antiInviteLimit: 'anti_invite_limit',
	antiInviteInterval: 'anti_invite_interval',
	antiChannelDeleteEnabled: 'anti_channel_delete_enabled',
	antiChannelDeleteLimit: 'anti_channel_delete_limit',
	antiChannelDeleteInterval: 'anti_channel_delete_interval',
	antiChannelCreateEnabled: 'anti_channel_create_enabled',
	antiChannelCreateLimit: 'anti_channel_create_limit',
	antiChannelCreateInterval: 'anti_channel_create_interval',
	antiRoleDeleteEnabled: 'anti_role_delete_enabled',
	antiRoleDeleteLimit: 'anti_role_delete_limit',
	antiRoleDeleteInterval: 'anti_role_delete_interval',
	antiRoleCreateEnabled: 'anti_role_create_enabled',
	antiRoleCreateLimit: 'anti_role_create_limit',
	antiRoleCreateInterval: 'anti_role_create_interval',
	antiRoleUpdateEnabled: 'anti_role_update_enabled',
	antiRoleUpdateLimit: 'anti_role_update_limit',
	antiRoleUpdateInterval: 'anti_role_update_interval',
	antiWebhookEnabled: 'anti_webhook_enabled',
	antiWebhookLimit: 'anti_webhook_limit',
	antiWebhookInterval: 'anti_webhook_interval',
	antiBotEnabled: 'anti_bot_enabled',
	antiBotLimit: 'anti_bot_limit',
	antiBotInterval: 'anti_bot_interval',
	antiPruneEnabled: 'anti_prune_enabled',
	antiEveryoneEnabled: 'anti_everyone_enabled',
	antiGuildUpdateEnabled: 'anti_guild_update_enabled',
	antiEmojiDeleteEnabled: 'anti_emoji_delete_enabled',
	antiEmojiDeleteLimit: 'anti_emoji_delete_limit',
	antiEmojiDeleteInterval: 'anti_emoji_delete_interval',
	antiVanityEnabled: 'anti_vanity_enabled',
	lockdownEnabled: 'lockdown_enabled',
	lockdownThreshold: 'lockdown_threshold',
	quarantineRoleId: 'quarantine_role_id',
};

export const AntinukeSchema = {
	get db() { return getDb(); },

	findOrCreate(guildId) {
		let cached = cache.get(guildId);
		if (cached) return cached;

		let row = this.db.prepare('SELECT * FROM antinuke WHERE guild_id = ?').get(guildId);
		if (!row) {
			this.db.prepare('INSERT OR IGNORE INTO antinuke (guild_id) VALUES (?)').run(guildId);
			row = this.db.prepare('SELECT * FROM antinuke WHERE guild_id = ?').get(guildId);
		}
		const data = this._des(row);
		cache.set(guildId, data);
		return data;
	},

	findById(guildId) {
		const cached = cache.get(guildId);
		if (cached) return cached;

		const row = this.db.prepare('SELECT * FROM antinuke WHERE guild_id = ?').get(guildId);
		const data = row ? this._des(row) : null;
		if (data) cache.set(guildId, data);
		return data;
	},

	update(guildId, data) {
		const setClauses = [];
		const values = [];
		for (const [jsKey, col] of Object.entries(COL_MAP)) {
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
		this.db.prepare(`UPDATE antinuke SET ${setClauses.join(', ')} WHERE guild_id = ?`).run(...values);
		cache.delete(guildId);
	},

	// ── Backup helpers ─────────────────────────────────────────────────────────
	saveBackup(guildId, channels, roles, vanityCode, metadata = {}) {
		const backupId = metadata.backupId || `BK-${guildId}-${Date.now().toString(36).toUpperCase()}`;
		this.db.prepare(`
			INSERT INTO antinuke_backups (guild_id, channels, roles, vanity_code, backup_name, guild_name, backup_id, guild_data, last_backup)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
			ON CONFLICT(guild_id) DO UPDATE SET
				channels = excluded.channels,
				roles = excluded.roles,
				vanity_code = excluded.vanity_code,
				backup_name = excluded.backup_name,
				guild_name = excluded.guild_name,
				backup_id = excluded.backup_id,
				guild_data = excluded.guild_data,
				last_backup = excluded.last_backup
		`).run(
			guildId,
			JSON.stringify(channels),
			JSON.stringify(roles),
			vanityCode ?? null,
			metadata.name || 'Automatic Backup',
			metadata.guildName || 'Unknown Server',
			backupId,
			JSON.stringify(metadata.guildData || {})
		);
		return backupId;
	},

	getBackup(guildId) {
		const row = this.db.prepare('SELECT * FROM antinuke_backups WHERE guild_id = ?').get(guildId);
		if (!row) return null;
		return {
			guildId: row.guild_id,
			channels: JSON.parse(row.channels),
			roles: JSON.parse(row.roles),
			vanityCode: row.vanity_code,
			backupName: row.backup_name,
			guildName: row.guild_name,
			backupId: row.backup_id,
			guildData: JSON.parse(row.guild_data || '{}'),
			lastBackup: new Date(row.last_backup),
		};
	},

	getAllBackups() {
		return this.db.prepare('SELECT * FROM antinuke_backups ORDER BY last_backup DESC').all().map(row => ({
			guildId: row.guild_id,
			backupName: row.backup_name,
			guildName: row.guild_name,
			backupId: row.backup_id,
			lastBackup: new Date(row.last_backup),
		}));
	},

	// ── Log helpers ────────────────────────────────────────────────────────────
	logAction(guildId, executorId, actionType, targetId, targetData) {
		this.db.prepare(`
			INSERT INTO antinuke_logs (guild_id, executor_id, action_type, target_id, target_data)
			VALUES (?, ?, ?, ?, ?)
		`).run(guildId, executorId, actionType, targetId ?? null, targetData ? JSON.stringify(targetData) : null);
	},

	getRecentLogs(guildId, limit = 20) {
		return this.db.prepare(
			'SELECT * FROM antinuke_logs WHERE guild_id = ? ORDER BY id DESC LIMIT ?'
		).all(guildId, limit).map(r => ({
			...r,
			targetData: r.target_data ? JSON.parse(r.target_data) : null,
			timestamp: new Date(r.timestamp),
		}));
	},

	/** @private */
	_des(row) {
		const out = {};
		for (const [col, val] of Object.entries(row)) {
			if (col === 'guild_id') { out.guildId = val; continue; }
			const jsKey = Object.entries(COL_MAP).find(([, c]) => c === col)?.[0] ?? col;
			if (JSON_FIELDS.includes(col)) { out[jsKey] = JSON.parse(val); continue; }
			if (BOOL_FIELDS.includes(col)) { out[jsKey] = val === 1; continue; }
			if (col === 'created_at') { out.createdAt = new Date(val); continue; }
			if (col === 'updated_at') { out.updatedAt = new Date(val); continue; }
			out[jsKey] = val;
		}
		return out;
	},
};
