import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { db } from '#dbManager';
import { logger } from '#utils';

export class BackupManager {
	/**
	 * Creates a full backup snapshot of the guild.
	 * @param {import('discord.js').Guild} guild
	 * @param {string} [name]
	 */
	static async createBackup(guild, name) {
		try {
			const roles = guild.roles.cache
				.filter(r => r.id !== guild.id && !r.managed)
				.sort((a, b) => b.position - a.position)
				.map(r => ({
					name: r.name,
					color: r.color,
					hoist: r.hoist,
					permissions: r.permissions.bitfield.toString(),
					mentionable: r.mentionable,
					position: r.position,
				}));

			const channels = [];
			const categories = guild.channels.cache
				.filter(c => c.type === ChannelType.GuildCategory)
				.sort((a, b) => a.position - b.position);

			for (const [, cat] of categories) {
				const catData = this._serializeChannel(cat);
				catData.children = guild.channels.cache
					.filter(c => c.parentId === cat.id)
					.sort((a, b) => a.position - b.position)
					.map(c => this._serializeChannel(c));
				channels.push(catData);
			}

			// Add orphaned channels (no category)
			const orphaned = guild.channels.cache
				.filter(c => !c.parentId && c.type !== ChannelType.GuildCategory)
				.sort((a, b) => a.position - b.position);
			for (const [, ch] of orphaned) {
				channels.push(this._serializeChannel(ch));
			}

			const guildData = {
				icon: guild.iconURL({ size: 1024 }),
				banner: guild.bannerURL({ size: 1024 }),
				splash: guild.splashURL({ size: 1024 }),
				discoverySplash: guild.discoverySplashURL({ size: 1024 }),
				verificationLevel: guild.verificationLevel,
				explicitContentFilter: guild.explicitContentFilter,
				defaultMessageNotifications: guild.defaultMessageNotifications,
				afkChannelId: guild.afkChannelId,
				afkTimeout: guild.afkTimeout,
				systemChannelId: guild.systemChannelId,
				systemChannelFlags: guild.systemChannelFlags.bitfield,
				rulesChannelId: guild.rulesChannelId,
				publicUpdatesChannelId: guild.publicUpdatesChannelId,
				preferredLocale: guild.preferredLocale,
				description: guild.description,
				premiumProgressBarEnabled: guild.premiumProgressBarEnabled,
			};

			const metadata = {
				name: name || `Backup ${new Date().toLocaleDateString()}`,
				guildName: guild.name,
				guildData: guildData,
			};

			return db.antinuke.saveBackup(guild.id, channels, roles, guild.vanityURLCode, metadata);
		} catch (e) {
			logger.error('BackupManager', `Create failed: ${e.message}`);
			throw e;
		}
	}

	/**
	 * Restores a backup to the target guild.
	 * @param {import('discord.js').Guild} guild
	 * @param {Object} backup
	 * @param {Object} [options]
	 * @param {boolean} [options.clearExisting=false]
	 */
	static async loadBackup(guild, backup, options = {}) {
		try {
			if (options.clearExisting) {
				const toDelete = guild.channels.cache.filter(c => c.manageable);
				for (const [, ch] of toDelete) await ch.delete().catch(() => {});
			}

			// 1. Create Roles
			const roleMap = new Map(); // oldName -> newId
			for (const rData of backup.roles) {
				const role = await guild.roles.create({
					name: rData.name,
					color: rData.color,
					hoist: rData.hoist,
					permissions: BigInt(rData.permissions),
					mentionable: rData.mentionable,
					reason: '[Backup] Restore',
				}).catch(() => null);
				if (role) roleMap.set(rData.name, role.id);
			}

			// 2. Create Channels
			for (const chData of backup.channels) {
				await this._createChannel(guild, chData, null, roleMap);
			}

			// 3. Restore Guild Settings
			if (backup.guildData) {
				const gd = backup.guildData;
				await guild.edit({
					icon: gd.icon,
					banner: gd.banner,
					splash: gd.splash,
					discoverySplash: gd.discoverySplash,
					verificationLevel: gd.verificationLevel,
					explicitContentFilter: gd.explicitContentFilter,
					defaultMessageNotifications: gd.defaultMessageNotifications,
					afkTimeout: gd.afkTimeout,
					systemChannelFlags: gd.systemChannelFlags,
					preferredLocale: gd.preferredLocale,
					description: gd.description,
					premiumProgressBarEnabled: gd.premiumProgressBarEnabled,
				}).catch(e => logger.error('BackupManager', `Guild edit failed: ${e.message}`));

				// Try to set vanity if possible (requires boost level)
				if (backup.vanityCode && guild.features.includes('VANITY_URL')) {
					await guild.setVanityCode(backup.vanityCode).catch(() => {});
				}
			}

			return true;
		} catch (e) {
			logger.error('BackupManager', `Load failed: ${e.message}`);
			throw e;
		}
	}

	/**
	 * Clones bot configuration from one server to another.
	 * @param {string} sourceGuildId
	 * @param {string} targetGuildId
	 */
	static async syncSettings(sourceGuildId, targetGuildId) {
		const services = [
			{ name: 'antinuke', svc: db.antinuke },
			{ name: 'automod', svc: db.automod },
			{ name: 'automodExt', svc: db.automodExt },
			{ name: 'autorole', svc: db.autorole },
			{ name: 'logging', svc: db.logging },
		];

		for (const { name, svc } of services) {
			try {
				const cfg = svc.get(sourceGuildId);
				if (cfg) {
					// Remove ID fields to avoid conflicts
					const clone = JSON.parse(JSON.stringify(cfg));
					delete clone.guildId;
					delete clone.id;
					svc.set(targetGuildId, clone);
				}
			} catch (e) {
				logger.error('BackupManager', `Sync failed for ${name}: ${e.message}`);
			}
		}
	}

	/**
	 * Full server sync: Channels, Roles, and Settings.
	 * @param {import('discord.js').Guild} sourceGuild
	 * @param {import('discord.js').Guild} targetGuild
	 */
	static async syncServer(sourceGuild, targetGuild) {
		logger.info('BackupManager', `Initiating full sync from ${sourceGuild.name} to ${targetGuild.name}`);
		
		// 1. Take fresh backup of source
		const backupId = await this.createBackup(sourceGuild, `Sync Source: ${sourceGuild.name}`);
		const backup = db.antinuke.getBackup(sourceGuild.id, backupId);
		
		if (!backup) throw new Error('Failed to capture source backup');

		// 2. Load backup to target
		await this.loadBackup(targetGuild, backup, { clearExisting: true });

		// 3. Sync Settings
		await this.syncSettings(sourceGuild.id, targetGuild.id);

		logger.info('BackupManager', `Sync completed successfully`);
		return true;
	}

	/** @private */
	static _serializeChannel(ch) {
		return {
			name: ch.name,
			type: ch.type,
			topic: ch.isTextBased() ? ch.topic : null,
			nsfw: ch.isTextBased() ? ch.nsfw : false,
			bitrate: ch.bitrate || null,
			userLimit: ch.userLimit || null,
			permissionOverwrites: ch.permissionOverwrites?.cache.map(o => {
				const role = o.type === 0 ? ch.guild.roles.cache.get(o.id) : null;
				return {
					id: o.id,
					type: o.type,
					name: role?.name || null,
					allow: o.allow.bitfield.toString(),
					deny: o.deny.bitfield.toString(),
				};
			}) ?? [],
		};
	}

	/** @private */
	static async _createChannel(guild, data, parentId, roleMap) {
		const overwrites = data.permissionOverwrites.map(o => {
			let targetId = o.id;
			if (o.type === 0 && o.name && roleMap.has(o.name)) {
				targetId = roleMap.get(o.name);
			} else if (o.type === 0 && o.name === '@everyone') {
				targetId = guild.id;
			}

			return {
				id: targetId,
				type: o.type,
				allow: BigInt(o.allow),
				deny: BigInt(o.deny),
			};
		});

		const channel = await guild.channels.create({
			name: data.name,
			type: data.type,
			parent: parentId,
			topic: data.topic,
			nsfw: data.nsfw,
			bitrate: data.bitrate,
			userLimit: data.userLimit,
			permissionOverwrites: overwrites,
			reason: '[Backup] Restore',
		}).catch(() => null);

		if (channel && data.children) {
			for (const childData of data.children) {
				await this._createChannel(guild, childData, channel.id, roleMap);
			}
		}
	}
}
