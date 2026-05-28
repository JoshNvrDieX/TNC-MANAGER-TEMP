import { getDb } from '#db/sqlite';
import { CacheManager } from '#utils';

const cache = new CacheManager();

/**
 * Guild table helpers — thin wrapper around the SQLite guilds table.
 * Mirrors the interface previously provided by the Mongoose Guild model.
 */
export const Guild = {
	/** @returns {import('better-sqlite3').Database} */
	get db() {
		return getDb();
	},

	/**
	 * Find a guild by ID.
	 * @param {string} id
	 * @returns {Object|null}
	 */
	findById(id) {
		const cached = cache.get(id);
		if (cached) return cached;

		const row = this.db.prepare('SELECT * FROM guilds WHERE id = ?').get(id);
		const data = row ? this._deserialise(row) : null;
		if (data) cache.set(id, data);
		return data;
	},

	/**
	 * Upsert a guild row (insert if not exists, leave existing data untouched).
	 * @param {string} id
	 * @param {Object} defaults
	 * @returns {Object}
	 */
	findOrCreate(id, defaults = {}) {
		const existing = this.findById(id);
		if (existing) return existing;

		const prefixes = JSON.stringify(defaults.prefixes ?? ['.']);
		const ignoredChannels = JSON.stringify(defaults.ignoredChannels ?? []);

		this.db
			.prepare(
				`INSERT OR IGNORE INTO guilds (id, prefixes, ignored_channels)
				 VALUES (?, ?, ?)`,
			)
			.run(id, prefixes, ignoredChannels);

		return this.findById(id);
	},

	/**
	 * Apply a partial update to a guild row.
	 * @param {string} id
	 * @param {Object} data
	 */
	update(id, data) {
		const colMap = {
			prefixes: 'prefixes',
			ignoredChannels: 'ignored_channels',
			isCustomProfile: 'is_custom_profile',
			avatarUpdatedAt: 'avatar_updated_at',
			bannerUpdatedAt: 'banner_updated_at',
			bioUpdatedAt: 'bio_updated_at',
			displayNameUpdatedAt: 'display_name_updated_at',
			profileBioText: 'profile_bio_text',
			nameStyleData: 'name_style_data',
		};

		const setClauses = [];
		const values = [];

		for (const [key, col] of Object.entries(colMap)) {
			if (data[key] === undefined) continue;
			setClauses.push(`${col} = ?`);

			if (Array.isArray(data[key])) {
				values.push(JSON.stringify(data[key]));
			} else if (data[key] instanceof Date) {
				values.push(data[key].toISOString());
			} else if (typeof data[key] === 'boolean') {
				values.push(data[key] ? 1 : 0);
			} else if (typeof data[key] === 'object' && data[key] !== null && !(data[key] instanceof Date)) {
				values.push(JSON.stringify(data[key]));
			} else {
				values.push(data[key]);
			}
		}

		if (setClauses.length === 0) return;

		setClauses.push(`updated_at = datetime('now')`);
		values.push(id);

		this.db
			.prepare(`UPDATE guilds SET ${setClauses.join(', ')} WHERE id = ?`)
			.run(...values);
			
		cache.delete(id);
	},

	/**
	 * Delete a guild row.
	 * @param {string} id
	 */
	delete(id) {
		this.db.prepare('DELETE FROM guilds WHERE id = ?').run(id);
		cache.delete(id);
	},

	/**
	 * Return all guild rows.
	 * @returns {Object[]}
	 */
	findAll() {
		return this.db.prepare('SELECT * FROM guilds').all().map(this._deserialise);
	},

	/** @private */
	_deserialise(row) {
		return {
			id: row.id,
			prefixes: JSON.parse(row.prefixes),
			ignoredChannels: JSON.parse(row.ignored_channels),
			isCustomProfile: row.is_custom_profile === 1,
			avatarUpdatedAt: row.avatar_updated_at ? new Date(row.avatar_updated_at) : null,
			bannerUpdatedAt: row.banner_updated_at ? new Date(row.banner_updated_at) : null,
			bioUpdatedAt: row.bio_updated_at ? new Date(row.bio_updated_at) : null,
			displayNameUpdatedAt: row.display_name_updated_at ? new Date(row.display_name_updated_at) : null,
			profileBioText: row.profile_bio_text || null,
			nameStyleData: row.name_style_data ? JSON.parse(row.name_style_data) : {},
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at),
		};
	},
};
