/**
 * SmartCache — wraps DB service reads with in-memory TTL caching.
 * Prevents hitting SQLite on every event/message when config rarely changes.
 *
 * Usage:
 *   import { smartCache } from '#classes/dbCache';
 *   const cfg = smartCache.automod(guildId);   // cached for 60s
 *   smartCache.invalidate('automod', guildId); // call after any write
 */
import { ReiT } from '#classes/rei';
import { db } from '#dbManager';

// Separate TTL stores per namespace
const stores = {
	automod:    new ReiT(1000),  // 60s TTL
	automodExt: new ReiT(1000),
	antinuke:   new ReiT(1000),
	logging:    new ReiT(1000),
	guild:      new ReiT(2000),  // 5min TTL
	autorole:   new ReiT(500),
};

const TTL = {
	automod:    60,
	automodExt: 60,
	antinuke:   60,
	logging:    120,
	guild:      300,
	autorole:   120,
};

export const smartCache = {
	/**
	 * Get automod config, cached.
	 * @param {string} guildId
	 * @returns {Object}
	 */
	automod(guildId) {
		const cached = stores.automod.get(guildId);
		if (cached !== undefined) return cached;
		const val = db.automod?.get(guildId);
		if (val) stores.automod.set(guildId, val, TTL.automod);
		return val;
	},

	automodExt(guildId) {
		const cached = stores.automodExt.get(guildId);
		if (cached !== undefined) return cached;
		const val = db.automodExt?.get(guildId);
		if (val) stores.automodExt.set(guildId, val, TTL.automodExt);
		return val;
	},

	antinuke(guildId) {
		const cached = stores.antinuke.get(guildId);
		if (cached !== undefined) return cached;
		const val = db.antinuke?.get(guildId);
		if (val) stores.antinuke.set(guildId, val, TTL.antinuke);
		return val;
	},

	logging(guildId) {
		const cached = stores.logging.get(guildId);
		if (cached !== undefined) return cached;
		const val = db.logging?.get(guildId);
		if (val) stores.logging.set(guildId, val, TTL.logging);
		return val;
	},

	guild(guildId) {
		const cached = stores.guild.get(guildId);
		if (cached !== undefined) return cached;
		const val = db.guild?.getGuild(guildId);
		if (val) stores.guild.set(guildId, val, TTL.guild);
		return val;
	},

	autorole(guildId) {
		const cached = stores.autorole.get(guildId);
		if (cached !== undefined) return cached;
		const val = db.autorole?.get(guildId);
		if (val) stores.autorole.set(guildId, val, TTL.autorole);
		return val;
	},

	/**
	 * Invalidate a specific namespace + guildId after a write.
	 * @param {'automod'|'automodExt'|'antinuke'|'logging'|'guild'|'autorole'} namespace
	 * @param {string} guildId
	 */
	invalidate(namespace, guildId) {
		stores[namespace]?.del(guildId);
	},

	/** Invalidate all caches for a guild (e.g. on guild leave). */
	invalidateAll(guildId) {
		for (const store of Object.values(stores)) {
			store.del(guildId);
		}
	},

	/** Stats for the stats command. */
	stats() {
		return Object.fromEntries(
			Object.entries(stores).map(([k, s]) => [k, { size: s.size, ...s.stats() }])
		);
	},

	/** Clear all caches (e.g. on restart). */
	clearAll() {
		for (const store of Object.values(stores)) {
			store.clear();
		}
	},

	/** Invalidate a guild's data across all namespaces via a regex key pattern. */
	invalidateByPattern(namespace, pattern) {
		const store = stores[namespace];
		if (!store) return;
		const keys = store.keys(pattern);
		store.mdel(keys);
	},
};
