import { initDatabase, closeDatabase } from '#db/sqlite';
import { GuildService } from '#dbServices/guilds';
import { AutomodService } from '#dbServices/automod';
import { AutomodExtService } from '#dbServices/automodExt';
import { AntinukeService } from '#dbServices/antinuke';
import { LoggingService } from '#dbServices/logging';
import { AutoroleService } from '#dbServices/autorole';
import { TncService } from '#dbServices/tnc';
import { UserProfileService } from '#dbServices/userProfiles';
import { logger } from '#utils';

export class DatabaseManager {
	constructor() {
		this.client = null;
		this.guild = null;
		this.automod = null;
		this.automodExt = null;
		this.antinuke = null;
		this.logging = null;
		this.autorole = null;
		this.tnc = null;
		this.userProfiles = null;
		this.initialized = false;
	}

	/**
	 * Set the bot client reference (called during Bot.init()).
	 * This breaks the circular dependency: repo can access client.cache.
	 * @param {import('#classes/client').Bot} client
	 */
	setClient(client) {
		this.client = client;
		if (this.guild) {
			this.guild.setClient(client);
		}
	}

	async init() {
		if (this.initialized) return this;
		try {
			initDatabase();
			this.guild = new GuildService();
			this.automod = new AutomodService();
			this.automodExt = new AutomodExtService();
			this.antinuke = new AntinukeService();
			this.logging = new LoggingService();
			this.autorole = new AutoroleService();
		this.tnc = new TncService();
		this.userProfiles = new UserProfileService();
		if (this.client) {
				this.guild.setClient(this.client);
			}
			this.initialized = true;
			logger.success('DatabaseManager', 'All services initialized');
		} catch (error) {
			logger.error('DatabaseManager', 'Failed to initialize database', error);
			throw error;
		}
		return this;
	}

	async closeAll() {
		if (!this.initialized) return;
		try {
			closeDatabase();
			this.initialized = false;
			logger.info('DatabaseManager', 'Database connection closed');
		} catch (error) {
			logger.error('DatabaseManager', 'Failed to close database connection', error);
			throw error;
		}
	}
}

let dbInstance = null;
export const getDb = () => { if (!dbInstance) dbInstance = new DatabaseManager(); return dbInstance; };
export const db = getDb();
