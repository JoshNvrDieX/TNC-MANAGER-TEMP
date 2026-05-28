import { getDb } from '#db/sqlite';
import { CacheManager } from '#utils';

const cache = new CacheManager();

export const AutoroleSchema = {
	get db() { return getDb(); },

	findOrCreate(guildId) {
		let cached = cache.get(guildId);
		if (cached) return cached;

		let row = this.db.prepare('SELECT * FROM autorole WHERE guild_id = ?').get(guildId);
		if (!row) {
			this.db.prepare('INSERT OR IGNORE INTO autorole (guild_id) VALUES (?)').run(guildId);
			row = this.db.prepare('SELECT * FROM autorole WHERE guild_id = ?').get(guildId);
		}
		const data = this._des(row);
		cache.set(guildId, data);
		return data;
	},

	update(guildId, data) {
		const setClauses = [];
		const values = [];
		const map = { enabled: 'enabled', roleIds: 'role_ids', botRoleIds: 'bot_role_ids' };
		for (const [jsKey, col] of Object.entries(map)) {
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
		this.db.prepare(`UPDATE autorole SET ${setClauses.join(', ')} WHERE guild_id = ?`).run(...values);
		cache.delete(guildId);
	},

	_des(row) {
		return {
			guildId: row.guild_id,
			enabled: row.enabled === 1,
			roleIds: JSON.parse(row.role_ids),
			botRoleIds: JSON.parse(row.bot_role_ids),
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at),
		};
	},
};
