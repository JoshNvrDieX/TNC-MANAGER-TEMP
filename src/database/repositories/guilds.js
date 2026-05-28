import { Guild } from '#dbSchema/guilds';
import { config } from '#config';

const CACHE_TTL = 18000;
const CACHE_PREFIX = 'guild:';

export class GuildRepository {
	constructor() {
		/** @type {import('#classes/client').Bot|null} Set after DB init via GuildService.setClient */
		this.client = null;
	}

	/**
	 * Fetches a guild by ID. Returns the cached record if available.
	 * @param {string} guildId
	 * @returns {Promise<Object|null>}
	 */
	async findById(guildId) {
		if (!guildId) return null;

		const cacheKey = `${CACHE_PREFIX}${guildId}`;
		const cached = await this.client.c.get(cacheKey);
		if (cached !== null && cached !== undefined) return cached;

		const result = Guild.findById(guildId);
		if (result) {
			await this.client.c.set(cacheKey, result, CACHE_TTL);
		}

		return result;
	}

	/**
	 * Returns the guild record, creating a default one if absent.
	 * @param {string} guildId
	 * @returns {Promise<Object>}
	 */
	async findOrCreate(guildId) {
		if (!guildId) throw new Error('Invalid guildId');

		let guild = await this.findById(guildId);
		if (!guild) {
			guild = Guild.findOrCreate(guildId, {
				prefixes: [config.prefix],
				ignoredChannels: [],
			});

			await Promise.all([
				this.client.c.set(`${CACHE_PREFIX}${guildId}`, guild, CACHE_TTL),
				this._invalidateListCaches(),
			]);
		}

		return guild;
	}

	/**
	 * Applies a partial update to a guild row.
	 * @param {string} guildId
	 * @param {Object} data
	 * @returns {Promise<void>}
	 */
	async update(guildId, data) {
		if (!guildId) return;

		Guild.update(guildId, data);
		await this._invalidateGuildCaches(guildId);
	}

	/**
	 * Deletes a guild row and purges its cache entries.
	 * @param {string} guildId
	 * @returns {Promise<void>}
	 */
	async delete(guildId) {
		if (!guildId) return;

		Guild.delete(guildId);
		await this._invalidateGuildCaches(guildId);
	}

	/**
	 * Returns all guild rows.
	 * @returns {Promise<Object[]>}
	 */
	async findAll() {
		const cacheKey = `${CACHE_PREFIX}all`;
		const cached = await this.client.c.get(cacheKey);
		if (cached !== null && cached !== undefined) return cached;

		const result = Guild.findAll();
		await this.client.c.set(cacheKey, result, 1800);

		return result;
	}

	/** @private */
	async _invalidateGuildCaches(guildId) {
		await this.client.c.mdel([`${CACHE_PREFIX}${guildId}`, `${CACHE_PREFIX}all`]);
	}

	/** @private */
	async _invalidateListCaches() {
		await this.client.c.mdel([`${CACHE_PREFIX}all`]);
	}
}
