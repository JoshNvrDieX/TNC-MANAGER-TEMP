import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { logger } from "#utils";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "..", "data", "bot.db");

let db = null;

/**
 * Initialises the SQLite database and creates tables if they don't exist.
 * @returns {import('better-sqlite3').Database}
 */
export const initDatabase = () => {
  if (db) return db;

  // Ensure data directory exists
  mkdirSync(join(__dirname, "..", "..", "data"), { recursive: true });

  db = new Database(DB_PATH);

  // WAL mode for better read performance
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // ── Migrations (safe ALTER TABLE — ignored if column already exists) ───────
  const migrations = [
    `ALTER TABLE logging ADD COLUMN setup_category_id TEXT DEFAULT NULL`,
    `ALTER TABLE logging ADD COLUMN member_role_channel TEXT DEFAULT NULL`,
    `ALTER TABLE logging ADD COLUMN nickname_channel TEXT DEFAULT NULL`,
    `ALTER TABLE logging ADD COLUMN rejoin_channel TEXT DEFAULT NULL`,
    `ALTER TABLE logging ADD COLUMN server_channel TEXT DEFAULT NULL`,
    `ALTER TABLE logging ADD COLUMN thread_channel TEXT DEFAULT NULL`,
    `ALTER TABLE logging ADD COLUMN webhook_channel TEXT DEFAULT NULL`,
    `ALTER TABLE logging ADD COLUMN mod_channel TEXT DEFAULT NULL`,
    `ALTER TABLE logging ADD COLUMN bot_commands_channel TEXT DEFAULT NULL`,
    `ALTER TABLE logging ADD COLUMN autorole_channel TEXT DEFAULT NULL`,
    `ALTER TABLE logging ADD COLUMN automod_channel TEXT DEFAULT NULL`,
    `ALTER TABLE antinuke ADD COLUMN lockdown_enabled INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE antinuke ADD COLUMN lockdown_threshold INTEGER NOT NULL DEFAULT 5`,
    `ALTER TABLE antinuke ADD COLUMN quarantine_role_id TEXT DEFAULT NULL`,
    `ALTER TABLE automod ADD COLUMN regex_filter_list TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE automod_ext ADD COLUMN phishing_protection_level TEXT NOT NULL DEFAULT 'standard'`,
    `ALTER TABLE antinuke_backups ADD COLUMN backup_name TEXT DEFAULT 'Automatic Backup'`,
    `ALTER TABLE antinuke_backups ADD COLUMN guild_name TEXT DEFAULT 'Unknown Server'`,
    `ALTER TABLE antinuke_backups ADD COLUMN backup_id TEXT DEFAULT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_backup_id ON antinuke_backups(backup_id)`,
    `ALTER TABLE antinuke ADD COLUMN anti_invite_enabled INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE antinuke ADD COLUMN anti_invite_limit INTEGER NOT NULL DEFAULT 5`,
    `ALTER TABLE antinuke ADD COLUMN anti_invite_interval INTEGER NOT NULL DEFAULT 10000`,
    `ALTER TABLE antinuke_backups ADD COLUMN guild_data TEXT DEFAULT '{}'`,
    `ALTER TABLE vc247 ADD COLUMN channel_status TEXT DEFAULT NULL`,
    `ALTER TABLE guilds ADD COLUMN display_name_updated_at TEXT DEFAULT NULL`,
    `ALTER TABLE guilds ADD COLUMN profile_bio_text TEXT DEFAULT NULL`,
    `ALTER TABLE guilds ADD COLUMN name_style_data TEXT DEFAULT '{}'`,
    `ALTER TABLE user_profiles ADD COLUMN font_id TEXT DEFAULT 'zillaslab'`,
  ];
  for (const sql of migrations) {
    try {
      db.exec(sql);
    } catch (e) {
      if (
        !e.message.includes("duplicate column name") &&
        !e.message.includes("no such table")
      ) {
        logger.error("Database", `Migration failed: ${sql} - ${e.message}`);
      }
    }
  }

  // Guilds table
  db.exec(`
		CREATE TABLE IF NOT EXISTS guilds (
			id TEXT PRIMARY KEY,
			prefixes TEXT NOT NULL DEFAULT '["." ]',
			ignored_channels TEXT NOT NULL DEFAULT '[]',
			is_custom_profile INTEGER NOT NULL DEFAULT 0,
			avatar_updated_at TEXT DEFAULT NULL,
			banner_updated_at TEXT DEFAULT NULL,
			bio_updated_at TEXT DEFAULT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

  // Automod config table
  db.exec(`
		CREATE TABLE IF NOT EXISTS automod (
			guild_id TEXT PRIMARY KEY,
			enabled INTEGER NOT NULL DEFAULT 0,
			log_channel TEXT DEFAULT NULL,

			-- Anti-spam
			anti_spam_enabled INTEGER NOT NULL DEFAULT 0,
			anti_spam_limit INTEGER NOT NULL DEFAULT 5,
			anti_spam_interval INTEGER NOT NULL DEFAULT 5000,
			anti_spam_action TEXT NOT NULL DEFAULT 'delete' CHECK(anti_spam_action IN ('delete','mute','kick','ban')),
			anti_spam_mute_duration INTEGER NOT NULL DEFAULT 300000,

			-- Anti-mention spam
			anti_mention_enabled INTEGER NOT NULL DEFAULT 0,
			anti_mention_limit INTEGER NOT NULL DEFAULT 5,
			anti_mention_action TEXT NOT NULL DEFAULT 'delete' CHECK(anti_mention_action IN ('delete','mute','kick','ban')),
			anti_mention_mute_duration INTEGER NOT NULL DEFAULT 300000,

			-- Anti-link
			anti_link_enabled INTEGER NOT NULL DEFAULT 0,
			anti_link_whitelist TEXT NOT NULL DEFAULT '[]',
			anti_link_action TEXT NOT NULL DEFAULT 'delete' CHECK(anti_link_action IN ('delete','mute','kick','ban')),
			anti_link_mute_duration INTEGER NOT NULL DEFAULT 300000,

			-- Anti-invite
			anti_invite_enabled INTEGER NOT NULL DEFAULT 0,
			anti_invite_action TEXT NOT NULL DEFAULT 'delete' CHECK(anti_invite_action IN ('delete','mute','kick','ban')),
			anti_invite_mute_duration INTEGER NOT NULL DEFAULT 300000,

			-- Anti-caps
			anti_caps_enabled INTEGER NOT NULL DEFAULT 0,
			anti_caps_threshold INTEGER NOT NULL DEFAULT 70,
			anti_caps_min_length INTEGER NOT NULL DEFAULT 10,
			anti_caps_action TEXT NOT NULL DEFAULT 'delete' CHECK(anti_caps_action IN ('delete','mute','kick','ban')),

			-- Anti-emoji spam
			anti_emoji_enabled INTEGER NOT NULL DEFAULT 0,
			anti_emoji_limit INTEGER NOT NULL DEFAULT 10,
			anti_emoji_action TEXT NOT NULL DEFAULT 'delete' CHECK(anti_emoji_action IN ('delete','mute','kick','ban')),

			-- Word filter
			word_filter_enabled INTEGER NOT NULL DEFAULT 0,
			word_filter_list TEXT NOT NULL DEFAULT '[]',
			word_filter_action TEXT NOT NULL DEFAULT 'delete' CHECK(word_filter_action IN ('delete','mute','kick','ban')),
			word_filter_mute_duration INTEGER NOT NULL DEFAULT 300000,

			-- Whitelisted roles/channels (bypass automod)
			whitelisted_roles TEXT NOT NULL DEFAULT '[]',
			whitelisted_channels TEXT NOT NULL DEFAULT '[]',

			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

  // Antinuke config table
  db.exec(`
		CREATE TABLE IF NOT EXISTS antinuke (
			guild_id TEXT PRIMARY KEY,
			enabled INTEGER NOT NULL DEFAULT 0,
			log_channel TEXT DEFAULT NULL,
			alert_channel TEXT DEFAULT NULL,

			-- Punishment settings
			punishment_type TEXT NOT NULL DEFAULT 'ban' CHECK(punishment_type IN ('ban','kick','strip_roles','quarantine')),
			auto_recovery INTEGER NOT NULL DEFAULT 1,
			quarantine_role TEXT DEFAULT NULL,

			-- Whitelist & trusted system
			owner_ids TEXT NOT NULL DEFAULT '[]',
			trusted_admins TEXT NOT NULL DEFAULT '[]',
			whitelisted_bots TEXT NOT NULL DEFAULT '[]',

			-- Anti-ban/kick
			anti_ban_enabled INTEGER NOT NULL DEFAULT 1,
			anti_ban_limit INTEGER NOT NULL DEFAULT 3,
			anti_ban_interval INTEGER NOT NULL DEFAULT 10000,

			anti_kick_enabled INTEGER NOT NULL DEFAULT 1,
			anti_kick_limit INTEGER NOT NULL DEFAULT 3,
			anti_kick_interval INTEGER NOT NULL DEFAULT 10000,

			-- Anti-channel
			anti_channel_delete_enabled INTEGER NOT NULL DEFAULT 1,
			anti_channel_delete_limit INTEGER NOT NULL DEFAULT 3,
			anti_channel_delete_interval INTEGER NOT NULL DEFAULT 10000,

			anti_channel_create_enabled INTEGER NOT NULL DEFAULT 1,
			anti_channel_create_limit INTEGER NOT NULL DEFAULT 5,
			anti_channel_create_interval INTEGER NOT NULL DEFAULT 10000,

			-- Anti-role
			anti_role_delete_enabled INTEGER NOT NULL DEFAULT 1,
			anti_role_delete_limit INTEGER NOT NULL DEFAULT 3,
			anti_role_delete_interval INTEGER NOT NULL DEFAULT 10000,

			anti_role_create_enabled INTEGER NOT NULL DEFAULT 1,
			anti_role_create_limit INTEGER NOT NULL DEFAULT 5,
			anti_role_create_interval INTEGER NOT NULL DEFAULT 10000,

			anti_role_update_enabled INTEGER NOT NULL DEFAULT 1,
			anti_role_update_limit INTEGER NOT NULL DEFAULT 5,
			anti_role_update_interval INTEGER NOT NULL DEFAULT 10000,

			-- Anti-webhook
			anti_webhook_enabled INTEGER NOT NULL DEFAULT 1,
			anti_webhook_limit INTEGER NOT NULL DEFAULT 3,
			anti_webhook_interval INTEGER NOT NULL DEFAULT 10000,

			-- Anti-bot
			anti_bot_enabled INTEGER NOT NULL DEFAULT 1,
			anti_bot_limit INTEGER NOT NULL DEFAULT 2,
			anti_bot_interval INTEGER NOT NULL DEFAULT 30000,

			-- Anti-prune
			anti_prune_enabled INTEGER NOT NULL DEFAULT 1,

			-- Anti-ping
			anti_everyone_enabled INTEGER NOT NULL DEFAULT 1,

			-- Anti-server settings
			anti_guild_update_enabled INTEGER NOT NULL DEFAULT 1,

			-- Anti-emoji/sticker
			anti_emoji_delete_enabled INTEGER NOT NULL DEFAULT 1,
			anti_emoji_delete_limit INTEGER NOT NULL DEFAULT 3,
			anti_emoji_delete_interval INTEGER NOT NULL DEFAULT 10000,

			-- Anti-vanity
			anti_vanity_enabled INTEGER NOT NULL DEFAULT 1,

			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

  // Antinuke backups table
  db.exec(`
		CREATE TABLE IF NOT EXISTS antinuke_backups (
			guild_id TEXT PRIMARY KEY,
			channels TEXT NOT NULL DEFAULT '[]',
			roles TEXT NOT NULL DEFAULT '[]',
			vanity_code TEXT DEFAULT NULL,
			backup_name TEXT DEFAULT 'Automatic Backup',
			guild_name TEXT DEFAULT 'Unknown Server',
			backup_id TEXT DEFAULT NULL,
			last_backup TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_backup_id ON antinuke_backups(backup_id)`,
  );

  // ── Automod extended tables ────────────────────────────────────────────────

  // Warning system
  db.exec(`
		CREATE TABLE IF NOT EXISTS automod_warnings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			guild_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			moderator_id TEXT NOT NULL,
			reason TEXT NOT NULL DEFAULT 'Automod violation',
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

  // Snipe / edit log cache (last 100 per guild, in-memory is fine but persist for restarts)
  db.exec(`
		CREATE TABLE IF NOT EXISTS message_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			guild_id TEXT NOT NULL,
			channel_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			content TEXT NOT NULL DEFAULT '',
			type TEXT NOT NULL DEFAULT 'delete' CHECK(type IN ('delete','edit')),
			old_content TEXT DEFAULT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

  // Auto-role on join
  db.exec(`
		CREATE TABLE IF NOT EXISTS autorole (
			guild_id TEXT PRIMARY KEY,
			enabled INTEGER NOT NULL DEFAULT 0,
			role_ids TEXT NOT NULL DEFAULT '[]',
			bot_role_ids TEXT NOT NULL DEFAULT '[]',
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

  // Logging system
  db.exec(`
		CREATE TABLE IF NOT EXISTS logging (
			guild_id TEXT PRIMARY KEY,
			enabled INTEGER NOT NULL DEFAULT 0,
			setup_category_id TEXT DEFAULT NULL,
			-- Message
			message_delete_channel TEXT DEFAULT NULL,
			message_edit_channel TEXT DEFAULT NULL,
			-- Members
			member_join_channel TEXT DEFAULT NULL,
			member_leave_channel TEXT DEFAULT NULL,
			member_ban_channel TEXT DEFAULT NULL,
			member_unban_channel TEXT DEFAULT NULL,
			member_role_channel TEXT DEFAULT NULL,
			nickname_channel TEXT DEFAULT NULL,
			rejoin_channel TEXT DEFAULT NULL,
			-- Roles
			role_channel TEXT DEFAULT NULL,
			-- Channels
			channel_channel TEXT DEFAULT NULL,
			-- Voice
			voice_channel TEXT DEFAULT NULL,
			-- Server
			server_channel TEXT DEFAULT NULL,
			-- Threads
			thread_channel TEXT DEFAULT NULL,
			-- Webhooks
			webhook_channel TEXT DEFAULT NULL,
			-- Invites
			invite_channel TEXT DEFAULT NULL,
			-- Mod actions
			mod_channel TEXT DEFAULT NULL,
			-- Bot commands
			bot_commands_channel TEXT DEFAULT NULL,
			-- Autorole
			autorole_channel TEXT DEFAULT NULL,
			-- Automod
			automod_channel TEXT DEFAULT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

  // Automod extended config (new features added to existing automod table via ALTER)
  // We use a separate table to avoid breaking existing installs
  db.exec(`
		CREATE TABLE IF NOT EXISTS automod_ext (
			guild_id TEXT PRIMARY KEY,

			-- Anti-ghost ping
			anti_ghost_ping_enabled INTEGER NOT NULL DEFAULT 0,
			anti_ghost_ping_action TEXT NOT NULL DEFAULT 'warn',

			-- Anti-zalgo
			anti_zalgo_enabled INTEGER NOT NULL DEFAULT 0,
			anti_zalgo_action TEXT NOT NULL DEFAULT 'delete',

			-- Anti-scam links
			anti_scam_enabled INTEGER NOT NULL DEFAULT 1,
			anti_scam_action TEXT NOT NULL DEFAULT 'ban',

			-- Media/file filter
			media_filter_enabled INTEGER NOT NULL DEFAULT 0,
			media_filter_blocked_types TEXT NOT NULL DEFAULT '[]',
			media_filter_action TEXT NOT NULL DEFAULT 'delete',

			-- Auto slowmode
			auto_slowmode_enabled INTEGER NOT NULL DEFAULT 0,
			auto_slowmode_threshold INTEGER NOT NULL DEFAULT 10,
			auto_slowmode_interval INTEGER NOT NULL DEFAULT 5000,
			auto_slowmode_duration INTEGER NOT NULL DEFAULT 10,

			-- Warning thresholds
			warn_mute_threshold INTEGER NOT NULL DEFAULT 3,
			warn_kick_threshold INTEGER NOT NULL DEFAULT 5,
			warn_ban_threshold INTEGER NOT NULL DEFAULT 7,
			warn_mute_duration INTEGER NOT NULL DEFAULT 300000,

			-- Username filter
			username_filter_enabled INTEGER NOT NULL DEFAULT 0,
			username_filter_list TEXT NOT NULL DEFAULT '[]',
			username_filter_action TEXT NOT NULL DEFAULT 'kick',

			-- Account age filter
			account_age_filter_enabled INTEGER NOT NULL DEFAULT 0,
			account_age_min_days INTEGER NOT NULL DEFAULT 7,
			account_age_action TEXT NOT NULL DEFAULT 'kick',

			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

  // 24/7 VC & status config
  db.exec(`
		CREATE TABLE IF NOT EXISTS vc247 (
			guild_id TEXT PRIMARY KEY,
			enabled INTEGER NOT NULL DEFAULT 0,
			channel_id TEXT DEFAULT NULL,
			channel_status TEXT DEFAULT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

  db.exec(`
		CREATE TABLE IF NOT EXISTS bot_status (
			id INTEGER PRIMARY KEY CHECK(id = 1),
			enabled INTEGER NOT NULL DEFAULT 1,
			type TEXT NOT NULL DEFAULT 'CUSTOM' CHECK(type IN ('PLAYING','WATCHING','LISTENING','COMPETING','CUSTOM')),
			texts TEXT NOT NULL DEFAULT '["Hahaaaa!! | Try To Nuke Ngaaa"]',
			interval_seconds INTEGER NOT NULL DEFAULT 30,
			current_index INTEGER NOT NULL DEFAULT 0
		)
	`);

  // Antinuke action log (for recovery)
  db.exec(`
		CREATE TABLE IF NOT EXISTS antinuke_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			guild_id TEXT NOT NULL,
			executor_id TEXT NOT NULL,
			action_type TEXT NOT NULL,
			target_id TEXT DEFAULT NULL,
			target_data TEXT DEFAULT NULL,
			timestamp TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

  // User profiles table
  db.exec(`
		CREATE TABLE IF NOT EXISTS user_profiles (
			user_id TEXT PRIMARY KEY,
			tagline TEXT DEFAULT NULL,
			description TEXT DEFAULT NULL,
			location TEXT DEFAULT NULL,
			age TEXT DEFAULT NULL,
			profession TEXT DEFAULT NULL,
			banner_url TEXT DEFAULT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

  logger.success("Database", "SQLite database initialized");
  return db;
};

/**
 * Returns the active database instance.
 * @returns {import('better-sqlite3').Database}
 */
export const getDb = () => {
  if (!db)
    throw new Error("Database not initialized. Call initDatabase() first.");
  return db;
};

/**
 * Closes the SQLite database connection.
 */
export const closeDatabase = () => {
  if (db) {
    db.close();
    db = null;
    logger.info("Database", "SQLite database closed");
  }
};
