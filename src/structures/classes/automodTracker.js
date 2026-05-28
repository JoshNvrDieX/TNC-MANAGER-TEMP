/**
 * In-memory sliding-window tracker for automod rate limiting.
 * Zero dependencies — just a Map of timestamps per key.
 * Entries auto-expire so memory stays bounded.
 */
export class AutomodTracker {
	constructor() {
		/** @type {Map<string, number[]>} key → array of timestamps */
		this._windows = new Map();
	}

	/**
	 * Record an action and return how many times it has occurred within the window.
	 * @param {string} key      - Unique key e.g. `spam:guildId:userId`
	 * @param {number} windowMs - Time window in milliseconds
	 * @returns {number} Count of actions within the window (including this one)
	 */
	hit(key, windowMs) {
		const now = Date.now();
		const timestamps = (this._windows.get(key) ?? []).filter(t => now - t < windowMs);
		timestamps.push(now);
		this._windows.set(key, timestamps);
		return timestamps.length;
	}

	/**
	 * Reset the counter for a key (e.g. after punishment).
	 * @param {string} key
	 */
	reset(key) {
		this._windows.delete(key);
	}

	/**
	 * Purge all expired entries across all keys.
	 * Call this periodically to prevent unbounded memory growth.
	 * @param {number} maxAgeMs - Entries older than this are removed (default 60s)
	 */
	purge(maxAgeMs = 60_000) {
		const now = Date.now();
		for (const [key, timestamps] of this._windows) {
			const fresh = timestamps.filter(t => now - t < maxAgeMs);
			if (fresh.length === 0) this._windows.delete(key);
			else this._windows.set(key, fresh);
		}
	}
}

/** Singleton shared across all automod events */
export const tracker = new AutomodTracker();

// Purge stale entries every 2 minutes
setInterval(() => tracker.purge(120_000), 120_000);
