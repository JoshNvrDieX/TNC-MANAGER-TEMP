/**
 * Auto-backup: takes a server snapshot on ready and every 30 minutes.
 * Used by the recovery system to restore deleted channels/roles.
 */
import { ContainerBuilder, TextDisplayBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { AntinukeEngine } from '#classes/antinukeEngine';
import { db } from '#dbManager';
import { logger } from '#utils';

export default {
	name: 'clientReady',
	once: false, // we re-use the ready event name but this fires once
	async execute({ client }) {
		const runBackup = async () => {
			for (const [, guild] of client.guilds.cache) {
				const cfg = db.antinuke?.get(guild.id);
				if (!cfg?.enabled) continue;

				try {
					logger.info('Antinuke', `Starting scheduled backup for ${guild.name}...`);
					await AntinukeEngine.takeBackup(guild, `Auto-Backup ${new Date().toLocaleTimeString()}`);
					logger.info('Antinuke', `Successfully completed backup for ${guild.name}`);

					// Notify log channel
					const logChannelId = cfg.alertChannel ?? cfg.logChannel;
					if (logChannelId) {
						const logCh = guild.channels.cache.get(logChannelId);
						if (logCh?.isTextBased()) {
							const container = new ContainerBuilder().setAccentColor(0x5865F2); // Blurple
							container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 💾 Scheduled Backup`));
							container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
							container.addTextDisplayComponents(new TextDisplayBuilder().setContent([
								`### Server Snapshot Taken`,
								`- **Status :** ✅ Success`,
								`- **Timestamp :** <t:${Math.floor(Date.now() / 1000)}:F>`,
								`- **Schedule :** Every 30 Minutes`
							].join('\n')));
							container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
							container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# AUTO-BACKUP SYSTEM IS RUNNING NORMALLY`));
							container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`- **TNC MANAGEMENT**`));

							logCh.send({ 
								components: [container],
								flags: MessageFlags.IsComponentsV2 
							}).catch(() => {});
						}
					}
				} catch (e) {
					logger.error('Antinuke', `Scheduled backup failed for ${guild.name}: ${e.message}`);
				}
			}
		};

		// Initial run
		await runBackup();

		// Schedule periodic backups every 30 minutes
		setInterval(runBackup, 30 * 60 * 1000);

		logger.info('Antinuke', 'Auto-backup scheduler started');
	},
};
