import { logger } from '#utils';
import { Routes } from 'discord.js';
import { NativeAutomod } from '#classes/nativeAutomod';
import { config } from '#config';
import { pool } from '#classes/workerPool';
import { VC247Manager } from '#classes/vc247Manager';
import { StatusManager } from '#classes/statusManager';

export default {
	name: 'clientReady',
	once: true,
	async execute({ client }) {
		logger.success('Bot', `Logged in as ${client.user.tag}`);
		logger.info('Bot', `Serving ${client.guilds.cache.size} guilds`);

		// ── Start worker thread pool ───────────────────────────────────────────
		pool.init();

		// ── Status rotation ────────────────────────────────────────────────────
		StatusManager.start(client);

		// ── Resume 24/7 VC connections ─────────────────────────────────────────
		await VC247Manager.resumeAll(client).catch(() => {});

		// ── Register slash commands globally ──────────────────────────────────
		try {
			const slashData = client.commandHandler.getSlashCommandsData();

			if (slashData.length > 0) {
				await client.rest.put(
					Routes.applicationCommands(client.user.id),
					{ body: slashData },
				);
				logger.success('SlashCommands', `Registered ${slashData.length} global slash commands`);
			} else {
				logger.warn('SlashCommands', 'No slash commands found to register');
			}

			// Clear all guild-specific commands to prevent duplicates with globals
			const guildIds = client.guilds.cache.keys();
			let cleared = 0;
			for (const guildId of guildIds) {
				await client.rest.put(
					Routes.applicationGuildCommands(client.user.id, guildId),
					{ body: [] },
				);
				cleared++;
			}
			if (cleared > 0) {
				logger.info('SlashCommands', `Cleared guild-specific commands for ${cleared} guild(s)`);
			}
		} catch (error) {
			logger.error('SlashCommands', `Failed to register slash commands: ${error.message}`);
		}

		// ── Initial sync of native automod rules ───────────────────────────────
		await NativeAutomod.syncAll(client).catch(() => {});
	},
};
