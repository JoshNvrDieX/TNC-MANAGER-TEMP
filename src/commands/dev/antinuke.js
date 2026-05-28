import { Command } from '#command';
import {
	PermissionFlagsBits, MessageFlags, ButtonStyle,
	ActionRowBuilder, ButtonBuilder, ContainerBuilder,
	TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
	ModalBuilder, TextInputBuilder, TextInputStyle,
	StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, RoleSelectMenuBuilder, UserSelectMenuBuilder,
} from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';
import { emoji } from '#emoji';
import { InteractionRouter } from '#classes/interactionRouter';
import { autoDisable, disableComponents, logger } from '#utils';
import { AntinukeEngine } from '#classes/antinukeEngine';

const { colors } = config;

class AntinukeCommand extends Command {
	constructor() {
		super({
			name: 'antinuke',
			description: 'Configure the antinuke system',
			usage: 'antinuke',
			aliases: ['an', 'security'],
			category: 'Security',
			cooldown: 10,
			examples: ['antinuke'],
			userPermissions: [PermissionFlagsBits.Administrator],
			ownerOnly: true,
			enabledSlash: true,
			slashData: {
				name: 'antinuke',
				description: 'Configure the antinuke system',
				defaultMemberPermissions: PermissionFlagsBits.Administrator,
			},
		});

		// Register global handler for persistent buttons and modals
		InteractionRouter.register('an', async (i) => {
			const ctx = { guild: i.guild, author: i.user, client: i.client, user: i.user };
			const msg = i.message; 
			await this._handle(ctx, msg, i);
		});
	}

	async execute({ ctx }) {
		if (!ctx.guild) return ctx.reply('This command is only available in servers.');
		const cfg = db.antinuke.get(ctx.guild.id);
		await ctx.reply({ components: [this._renderMain(cfg)], flags: MessageFlags.IsComponentsV2 });
	}

	_renderMain(cfg) {
		const c = new ContainerBuilder().setAccentColor(cfg.enabled ? colors.success : colors.error);
		
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 🛡️ Antinuke Control Center'));
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent('Configure high-fidelity server protection and cross-server synchronization.'));
		
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

		const on = '<a:Online:1501899980405997579>';
		const off = '<a:reddot:1501900034478964838>';
		const status = (e) => e ? on : off;

		c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
			`### ⚙️ Global Configuration`,
			`**System Status:** ${status(cfg.enabled)} ${cfg.enabled ? 'Active' : 'Deactivated'}`,
			`**Punishment:** \`${(cfg.punishmentType || 'ban').toUpperCase()}\``,
			`**Auto-Recovery:** ${cfg.autoRecovery ? '✅ Enabled' : '❌ Disabled'}`,
			`**Lockdown Mode:** ${status(cfg.lockdownEnabled)} (Threshold: ${cfg.lockdownThreshold || 5})`,
			'',
			`### 🧩 Active Modules`,
			`| ${status(cfg.antiBanEnabled)} Ban | ${status(cfg.antiKickEnabled)} Kick | ${status(cfg.antiInviteEnabled)} Invite | ${status(cfg.antiWebhookEnabled)} Webhook | ${status(cfg.antiBotEnabled)} Bot |`,
			`| ${status(cfg.antiChannelDeleteEnabled)} Ch-Del | ${status(cfg.antiChannelCreateEnabled)} Ch-Create | ${status(cfg.antiRoleDeleteEnabled)} Role-Del |`,
			`| ${status(cfg.antiGuildUpdateEnabled)} Settings | ${status(cfg.antiEmojiDeleteEnabled)} Emoji | ${status(cfg.antiVanityEnabled)} Vanity |`,
		].join('\n')));

		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('an|toggle').setLabel(cfg.enabled ? 'Deactivate' : 'Activate').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
			new ButtonBuilder().setCustomId('an|lockdown').setLabel('Lockdown Settings').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('an|modules').setLabel('Modules').setStyle(ButtonStyle.Primary),
		));

		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('an|whitelist').setLabel('Whitelist').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('an|backup_menu').setLabel('Backup & Sync').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('an|logs').setLabel('Logs').setStyle(ButtonStyle.Secondary),
		));

		return c;
	}

	_renderWhitelist(guildId) {
		const cfg = db.antinuke.get(guildId);
		const trusted = (cfg.trustedAdmins ?? []).map(id => `<@${id}>`).join(' ') || 'None';
		const bots = (cfg.whitelistedBots ?? []).map(id => `<@${id}>`).join(' ') || 'None';
		const c = new ContainerBuilder().setAccentColor(colors.bot);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Whitelist\n**Trusted Admins:** ${trusted}\n**Whitelisted Bots:** ${bots}\n\n-# Trusted users bypass all antinuke checks.`));
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('an|whitelist|addadmin').setLabel('Add Admin').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('an|whitelist|addbot').setLabel('Add Bot').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('an|whitelist|clear').setLabel('Clear All').setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setCustomId('an|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
		));
		return c;
	}

	_renderModuleConfig(guildId, mod) {
		const cfg = db.antinuke.get(guildId);
		const MAP = {
			ban: ['antiBan', 'Anti-Ban'],
			kick: ['antiKick', 'Anti-Kick'],
			invite: ['antiInvite', 'Anti-Invite'],
			channeldelete: ['antiChannelDelete', 'Anti-Channel-Delete'],
			channelcreate: ['antiChannelCreate', 'Anti-Channel-Create'],
			roledelete: ['antiRoleDelete', 'Anti-Role-Delete'],
			rolecreate: ['antiRoleCreate', 'Anti-Role-Create'],
			roleupdate: ['antiRoleUpdate', 'Anti-Role-Update'],
			webhook: ['antiWebhook', 'Anti-Webhook'],
			bot: ['antiBot', 'Anti-Bot'],
		};
		const [key, title] = MAP[mod];
		const enabled = cfg[`${key}Enabled`];
		const limit = cfg[`${key}Limit`];
		const interval = cfg[`${key}Interval`];

		const c = new ContainerBuilder().setAccentColor(enabled ? colors.success : colors.error);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n**Status:** ${enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Limit:** ${limit} actions\n**Interval:** ${interval / 1000}s`));
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId(`an|modules|${mod}|toggle`).setLabel(enabled ? 'Disable' : 'Enable').setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success),
			new ButtonBuilder().setCustomId(`an|modules|${mod}|config`).setLabel('Configure').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('an|modules').setLabel('← Back').setStyle(ButtonStyle.Secondary),
		));
		return c;
	}

	_renderLockdown(guildId) {
		const cfg = db.antinuke.get(guildId);
		const on = '<a:Online:1501899980405997579>';
		const off = '<a:reddot:1501900034478964838>';
		const c = new ContainerBuilder().setAccentColor(colors.bot);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🔒 Lockdown Mode\nLockdown immediately restricts all non-trusted members from communicating when a severe attack is detected.\n\n**Status:** ${cfg.lockdownEnabled ? on : off}\n**Threshold:** ${cfg.lockdownThreshold} violations`));
		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('an|lockdown|toggle').setLabel(cfg.lockdownEnabled ? 'Disable Lockdown' : 'Enable Lockdown').setStyle(cfg.lockdownEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
			new ButtonBuilder().setCustomId('an|lockdown|threshold').setLabel('Change Threshold').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('an|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
		));
		return c;
	}

	async _handle(ctx, msg, i) {
		const guildId = ctx.guild.id;

		// Security: Only allow the person who ran the command or an administrator
		if (!ctx.client.config.ownerIds.includes(i.user.id) && !i.member.permissions.has(PermissionFlagsBits.Administrator)) {
			return i.reply({ content: `${emoji.get('cross')} This control panel is only for administrators.`, flags: MessageFlags.Ephemeral });
		}

		if (i.isModalSubmit()) {
			if (i.customId === 'an|lockdown|threshold_modal') {
				const threshold = parseInt(i.fields.getTextInputValue('threshold'));
				if (isNaN(threshold) || threshold < 1) {
					return i.reply({ content: '❌ Invalid threshold. Please enter a positive number.', flags: MessageFlags.Ephemeral });
				}
				await i.deferUpdate();
				db.antinuke.set(guildId, { lockdownThreshold: threshold });
				return msg.edit({ components: [this._renderLockdown(guildId)] });
			}

			if (i.customId.startsWith('an|modules|') && i.customId.endsWith('|modal')) {
				const mod = i.customId.split('|')[2];
				const limit = parseInt(i.fields.getTextInputValue('limit'));
				const intervalInput = i.fields.getTextInputValue('interval');
				const interval = parseInt(intervalInput) * 1000;
				
				if (isNaN(limit) || isNaN(interval) || limit < 1 || interval < 1000) {
					return i.reply({ 
						content: `${emoji.get('cross')} **Invalid Input**\nPlease enter valid positive numbers.\n- Limit must be at least 1\n- Interval must be at least 1 second`, 
						flags: MessageFlags.Ephemeral 
					});
				}

				await i.deferUpdate().catch(() => {});
				
				const MAP = {
					ban: 'antiBan', kick: 'antiKick', invite: 'antiInvite',
					channeldelete: 'antiChannelDelete', channelcreate: 'antiChannelCreate',
					roledelete: 'antiRoleDelete', rolecreate: 'antiRoleCreate', roleupdate: 'antiRoleUpdate',
					webhook: 'antiWebhook', bot: 'antiBot'
				};
				
				const key = MAP[mod];
				if (!key) throw new Error(`Unknown module: ${mod}`);

				db.antinuke.set(guildId, { [`${key}Limit`]: limit, [`${key}Interval`]: interval });
				
				return msg.edit({ 
					components: [this._renderModuleConfig(guildId, mod)],
					flags: MessageFlags.IsComponentsV2 
				}).catch(e => logger.error('Antinuke', `Failed to edit message after modal: ${e.message}`));
			}
			return;
		}

		const [, action, sub] = i.customId.split('|');

		if (action === 'toggle') {
			await i.deferUpdate();
			const cfg = db.antinuke.get(guildId);
			db.antinuke.setEnabled(guildId, !cfg.enabled);
			return msg.edit({ components: [this._renderMain(db.antinuke.get(guildId))] });
		}

		if (action === 'lockdown') {
			if (!sub) {
				await i.deferUpdate();
				return msg.edit({ components: [this._renderLockdown(guildId)] });
			}

			if (sub === 'toggle') {
				await i.deferUpdate();
				const cfg = db.antinuke.get(guildId);
				db.antinuke.set(guildId, { lockdownEnabled: !cfg.lockdownEnabled });
				return msg.edit({ components: [this._renderLockdown(guildId)] });
			}

			if (sub === 'threshold') {
				const cfg = db.antinuke.get(guildId);
				const modal = new ModalBuilder().setCustomId('an|lockdown|threshold_modal').setTitle('Lockdown Threshold');
				const input = new TextInputBuilder()
					.setCustomId('threshold')
					.setLabel('Violation Threshold (e.g. 5)')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('Number of violations to trigger lockdown')
					.setValue((cfg.lockdownThreshold || 5).toString())
					.setRequired(true);
				
				modal.addComponents(new ActionRowBuilder().addComponents(input));
				return i.showModal(modal);
			}
		}

		if (action === 'punishment' && !sub) {
			await i.deferUpdate();
			const c = new ContainerBuilder().setAccentColor(colors.bot);
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent('## Punishment Type\nSelect how to punish attackers:'));
			c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder().setCustomId('an|punishment|select')
					.setPlaceholder('Choose punishment')
					.addOptions([
						{ label: '🔨 Ban', value: 'ban', description: 'Permanently ban the attacker' },
						{ label: '👢 Kick', value: 'kick', description: 'Kick the attacker from the server' },
						{ label: '🔇 Strip Roles', value: 'strip_roles', description: 'Remove all dangerous permissions' },
						{ label: '🔒 Quarantine', value: 'quarantine', description: 'Move to quarantine role' },
					]),
			));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('an|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
			));
			return msg.edit({ components: [c] });
		}

		if (action === 'punishment' && sub === 'select') {
			await i.deferUpdate();
			db.antinuke.set(guildId, { punishmentType: i.values[0] });
			return msg.edit({ components: [this._renderMain(db.antinuke.get(guildId))] });
		}

		if (action === 'recovery' && !sub) {
			await i.deferUpdate();
			const cfg = db.antinuke.get(guildId);
			const c = new ContainerBuilder().setAccentColor(colors.bot);
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Auto-Recovery\n**Status:** ${cfg.autoRecovery ? '✅ Enabled' : '❌ Disabled'}\n\nWhen enabled, deleted channels/roles are automatically restored.`));
			c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('an|recovery|toggle').setLabel(cfg.autoRecovery ? 'Disable' : 'Enable').setStyle(cfg.autoRecovery ? ButtonStyle.Danger : ButtonStyle.Success),
				new ButtonBuilder().setCustomId('an|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
			));
			return msg.edit({ components: [c] });
		}

		if (action === 'recovery' && sub === 'toggle') {
			await i.deferUpdate();
			const cfg = db.antinuke.get(guildId);
			db.antinuke.set(guildId, { autoRecovery: !cfg.autoRecovery });
			return msg.edit({ components: [this._renderMain(db.antinuke.get(guildId))] });
		}

		if (action === 'channels' && !sub) {
			await i.deferUpdate();
			const cfg = db.antinuke.get(guildId);
			const c = new ContainerBuilder().setAccentColor(colors.bot);
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Channels\n**Log Channel:** ${cfg.logChannel ? `<#${cfg.logChannel}>` : 'Not set'}\n**Alert Channel:** ${cfg.alertChannel ? `<#${cfg.alertChannel}>` : 'Not set'}`));
			c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('an|channels|log').setLabel('Set Log Channel').setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId('an|channels|alert').setLabel('Set Alert Channel').setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId('an|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
			));
			return msg.edit({ components: [c] });
		}

		if (action === 'channels' && (sub === 'log' || sub === 'alert')) {
			await i.deferUpdate();
			const c = new ContainerBuilder().setAccentColor(colors.bot);
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Select a channel for ${sub === 'log' ? 'logs' : 'alerts'}:`));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ChannelSelectMenuBuilder().setCustomId(`an|channels|${sub}|select`)
					.setPlaceholder('Pick a channel')
					.setChannelTypes([ChannelType.GuildText])
					.setMinValues(0).setMaxValues(1),
			));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('an|channels').setLabel('← Back').setStyle(ButtonStyle.Secondary),
			));
			return msg.edit({ components: [c] });
		}

		if (action === 'channels' && sub && i.isChannelSelectMenu()) {
			await i.deferUpdate();
			const key = sub === 'log' ? 'logChannel' : 'alertChannel';
			db.antinuke.set(guildId, { [key]: i.values[0] ?? null });
			return msg.edit({ components: [this._renderMain(db.antinuke.get(guildId))] });
		}

		if (action === 'whitelist') {
			if (!sub) {
				await i.deferUpdate();
				return msg.edit({ components: [this._renderWhitelist(guildId)] });
			}

			if (sub === 'addadmin' || sub === 'addbot') {
				if (i.isUserSelectMenu()) {
					await i.deferUpdate();
					const userId = i.values[0];
					if (!userId) return msg.edit({ components: [this._renderWhitelist(guildId)] });

					const cfg = db.antinuke.get(guildId);
					const key = sub === 'addadmin' ? 'trustedAdmins' : 'whitelistedBots';
					const list = cfg[key] ?? [];
					if (!list.includes(userId)) {
						list.push(userId);
						db.antinuke.set(guildId, { [key]: list });
					}
					return msg.edit({ components: [this._renderWhitelist(guildId)] });
				}

				await i.deferUpdate();
				const c = new ContainerBuilder().setAccentColor(colors.bot);
				c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Select a ${sub === 'addadmin' ? 'user' : 'bot'} to whitelist:`));
				c.addActionRowComponents(new ActionRowBuilder().addComponents(
					new UserSelectMenuBuilder().setCustomId(`an|whitelist|${sub}`)
						.setPlaceholder('Pick a member')
						.setMinValues(0).setMaxValues(1),
				));
				c.addActionRowComponents(new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('an|whitelist').setLabel('← Back').setStyle(ButtonStyle.Secondary),
				));
				return msg.edit({ components: [c] });
			}

			if (sub === 'clear') {
				await i.deferUpdate();
				db.antinuke.set(guildId, { trustedAdmins: [], whitelistedBots: [] });
				return msg.edit({ components: [this._renderWhitelist(guildId)] });
			}
		}

		if (action === 'modules') {
			if (!sub) {
				await i.deferUpdate();
				const cfg = db.antinuke.get(guildId);
				const c = new ContainerBuilder().setAccentColor(colors.bot);
				c.addTextDisplayComponents(new TextDisplayBuilder().setContent('## Module Configuration\nSelect a module to configure:'));
				c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
				c.addActionRowComponents(new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId('an|modules|select')
						.setPlaceholder('Choose a module')
						.addOptions([
							{ label: 'Anti-Ban', value: 'ban' },
							{ label: 'Anti-Kick', value: 'kick' },
							{ label: 'Anti-Invite', value: 'invite' },
							{ label: 'Anti-Channel-Delete', value: 'channeldelete' },
							{ label: 'Anti-Channel-Create', value: 'channelcreate' },
							{ label: 'Anti-Role-Delete', value: 'roledelete' },
							{ label: 'Anti-Role-Create', value: 'rolecreate' },
							{ label: 'Anti-Role-Update', value: 'roleupdate' },
							{ label: 'Anti-Webhook', value: 'webhook' },
							{ label: 'Anti-Bot', value: 'bot' },
						]),
				));
				c.addActionRowComponents(new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('an|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
				));
				return msg.edit({ components: [c] });
			}

			if (sub === 'select') {
				await i.deferUpdate();
				return msg.edit({ components: [this._renderModuleConfig(guildId, i.values[0])] });
			}

			const MAP = {
				ban: ['antiBan', 'Anti-Ban'],
				kick: ['antiKick', 'Anti-Kick'],
				invite: ['antiInvite', 'Anti-Invite'],
				channeldelete: ['antiChannelDelete', 'Anti-Channel-Delete'],
				channelcreate: ['antiChannelCreate', 'Anti-Channel-Create'],
				roledelete: ['antiRoleDelete', 'Anti-Role-Delete'],
				rolecreate: ['antiRoleCreate', 'Anti-Role-Create'],
				roleupdate: ['antiRoleUpdate', 'Anti-Role-Update'],
				webhook: ['antiWebhook', 'Anti-Webhook'],
				bot: ['antiBot', 'Anti-Bot'],
			};
			const mod = sub;
			const [key, title] = MAP[mod];
			const btnAction = i.customId.split('|')[3];

			if (btnAction === 'toggle') {
				await i.deferUpdate();
				const cfg = db.antinuke.get(guildId);
				db.antinuke.set(guildId, { [`${key}Enabled`]: !cfg[`${key}Enabled`] });
				return msg.edit({ components: [this._renderModuleConfig(guildId, mod)] });
			}

			if (btnAction === 'config') {
				const cfg = db.antinuke.get(guildId);
				const modal = new ModalBuilder().setCustomId(`an|modules|${mod}|modal`).setTitle(`Configure ${title}`);
				const limitInput = new TextInputBuilder()
					.setCustomId('limit')
					.setLabel('Action Limit')
					.setStyle(TextInputStyle.Short)
					.setValue(cfg[`${key}Limit`].toString())
					.setRequired(true);
				
				const intervalInput = new TextInputBuilder()
					.setCustomId('interval')
					.setLabel('Interval (seconds)')
					.setStyle(TextInputStyle.Short)
					.setValue((cfg[`${key}Interval`] / 1000).toString())
					.setRequired(true);

				modal.addComponents(
					new ActionRowBuilder().addComponents(limitInput),
					new ActionRowBuilder().addComponents(intervalInput)
				);
				return i.showModal(modal);
			}
		}

		if (action === 'backup') {
			await i.deferUpdate();
			await AntinukeEngine.takeBackup(ctx.guild);
			await i.followUp({ content: `${emoji.check} Backup taken successfully!`, flags: MessageFlags.Ephemeral });
		}

		if (action === 'back') {
			await i.deferUpdate();
			return msg.edit({ components: [this._renderMain(db.antinuke.get(guildId))] });
		}

		if (action === 'backup_menu') {
			await i.deferUpdate();
			const c = new ContainerBuilder().setAccentColor(colors.bot);
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 💾 Backup & Sync\nSecure your server hierarchy and sync bot configurations across guilds.'));
			c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
			
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('an|backup|create').setLabel('Create Backup').setStyle(ButtonStyle.Success),
				new ButtonBuilder().setCustomId('an|backup|list').setLabel('Load Backup').setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId('an|sync|select').setLabel('Sync Bot Settings').setStyle(ButtonStyle.Secondary),
			));
			
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('an|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
			));
			return msg.edit({ components: [c] });
		}

		if (action === 'backup' && sub === 'create') {
			await i.deferUpdate();
			const { BackupManager } = await import('#classes/backupManager');
			await BackupManager.createBackup(ctx.guild);
			await i.followUp({ content: `${emoji.check} Backup created successfully for **${ctx.guild.name}**!`, flags: MessageFlags.Ephemeral });
			return msg.edit({ components: [this._renderMain(db.antinuke.get(guildId))] });
		}

		if (action === 'backup' && sub === 'list') {
			await i.deferUpdate();
			const backups = db.antinuke.getAllBackups();
			const c = new ContainerBuilder().setAccentColor(colors.bot);
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 📂 Global Backups\nSelect a backup to restore on this server. This will recreate roles and channels.'));
			
			if (!backups.length) {
				c.addTextDisplayComponents(new TextDisplayBuilder().setContent('*No backups found in the database.*'));
			} else {
				const options = backups.slice(0, 25).map(b => ({
					label: b.backupName,
					description: `Server: ${b.guildName} • ID: ${b.backupId}`,
					value: b.backupId,
				}));

				c.addActionRowComponents(new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId('an|backup|load')
						.setPlaceholder('Choose a backup to restore')
						.addOptions(options)
				));
			}

			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('an|backup_menu').setLabel('← Back').setStyle(ButtonStyle.Secondary),
			));
			return msg.edit({ components: [c] });
		}

		if (action === 'backup' && sub === 'load' && i.isStringSelectMenu()) {
			await i.deferUpdate();
			const backupId = i.values[0];
			const allBackups = db.antinuke.getAllBackups();
			// Since we only store one backup per guild currently in schema (keyed by guild_id), 
			// I need to find the backup by its ID if I implemented multiple. 
			// For now, I'll fetch the specific guild's backup if the ID matches.
			const backupMeta = allBackups.find(b => b.backupId === backupId);
			if (!backupMeta) return i.followUp({ content: `${emoji.cross} Backup not found.`, flags: MessageFlags.Ephemeral });

			const backup = db.antinuke.getBackup(backupMeta.guildId);

			const c = new ContainerBuilder().setAccentColor(colors.warn);
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ⚠️ Confirm Restoration\nYou are about to restore the backup from **${backupMeta.guildName}** on this server.\n\n**Warning:** This will recreate roles and channels. It may take some time.`));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId(`an|backup|confirm|${backupId}`).setLabel('Confirm Restore').setStyle(ButtonStyle.Danger),
				new ButtonBuilder().setCustomId('an|backup|list').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
			));
			return msg.edit({ components: [c] });
		}

		if (action === 'backup' && sub === 'confirm') {
			const backupId = i.customId.split('|')[3];
			await i.update({ content: '🔄 **Restoring backup... Please wait.**', components: [] });
			
			const allBackups = db.antinuke.getAllBackups();
			const backupMeta = allBackups.find(b => b.backupId === backupId);
			const backup = db.antinuke.getBackup(backupMeta.guildId);

			const { BackupManager } = await import('#classes/backupManager');
			try {
				await BackupManager.loadBackup(ctx.guild, backup);
				
				// Final Prompt: Sync Bot Settings?
				const c = new ContainerBuilder().setAccentColor(colors.success);
				c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`✅ **Backup Restored!**\n\nChannels and roles from **${backupMeta.guildName}** have been recreated.\n\n**Would you like to sync the bot settings (Antinuke, Automod, etc.) from that server as well?**`));
				c.addActionRowComponents(new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId(`an|sync|confirm|${backupMeta.guildId}`).setLabel('Yes, Sync Settings').setStyle(ButtonStyle.Success),
					new ButtonBuilder().setCustomId('an|back').setLabel('No, Finish').setStyle(ButtonStyle.Secondary),
				));
				return i.editReply({ content: null, components: [c] });
			} catch (e) {
				logger.error('Antinuke', `Restore failed: ${e.message}`);
				return i.editReply({ content: `❌ **Restore failed:** ${e.message}`, components: [] });
			}
		}

		if (action === 'sync' && sub === 'select') {
			await i.deferUpdate();
			const backups = db.antinuke.getAllBackups();
			const c = new ContainerBuilder().setAccentColor(colors.bot);
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 🔄 Manual Sync\nSelect a server to clone bot settings (Antinuke, Automod, etc.) from.'));
			
			if (!backups.length) {
				c.addTextDisplayComponents(new TextDisplayBuilder().setContent('*No source servers found.*'));
			} else {
				const options = backups.slice(0, 25).map(b => ({
					label: b.guildName,
					description: `Clone settings from ${b.guildName}`,
					value: b.guildId,
				}));

				c.addActionRowComponents(new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId('an|sync|confirm')
						.setPlaceholder('Choose source server')
						.addOptions(options)
				));
			}

			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('an|backup_menu').setLabel('← Back').setStyle(ButtonStyle.Secondary),
			));
			return msg.edit({ components: [c] });
		}

		if (action === 'sync' && sub === 'confirm') {
			const sourceId = i.isStringSelectMenu() ? i.values[0] : i.customId.split('|')[3];
			await i.deferUpdate();
			const { BackupManager } = await import('#classes/backupManager');
			await BackupManager.syncSettings(sourceId, ctx.guild.id);
			
			await i.editReply({ content: `✅ **Settings Synced!** Bot configurations have been cloned from the source server.`, components: [this._renderMain(db.antinuke.get(guildId))] });
		}

		if (action === 'logs') {
			await i.deferUpdate();
			const logs = db.antinuke.getRecentLogs(guildId, 10);
			const lines = logs.length ? logs.map(l => `\`${l.action_type}\` by <@${l.executor_id}> — <t:${Math.floor(l.timestamp.getTime() / 1000)}:R>`).join('\n') : 'No recent logs.';
			const c = new ContainerBuilder().setAccentColor(colors.bot);
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Recent Antinuke Logs\n${lines}`));
			c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('an|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
			));
			return msg.edit({ components: [c] });
		}

	}
}

export default new AntinukeCommand();
