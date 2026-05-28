import { Command } from '#command';
import {
	PermissionFlagsBits, MessageFlags, ButtonStyle, ChannelType,
	ActionRowBuilder, ButtonBuilder, ContainerBuilder,
	TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
	ChannelSelectMenuBuilder, StringSelectMenuBuilder,
} from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';
import { emoji } from '#emoji';
import { autoDisable, disableComponents, logger } from '#utils';

const { colors } = config;

// Channel name → DB key mapping for auto-setup
const LOG_CHANNELS = [
	{ key: 'automodChannel',       name: 'ᴀᴜᴛᴏᴍᴏᴅ-ʟᴏɢs',       label: '<a:tick:1501831530924867695> Automod Logs'      },
	{ key: 'messageDeleteChannel', name: 'ᴍᴇssᴀɢᴇ-ʟᴏɢs',       label: '<a:tick:1501831530924867695> Message Logs'      },
	{ key: 'messageEditChannel',   name: 'ᴇᴅɪᴛ-ʟᴏɢs',           label: '<a:tick:1501831530924867695> Edit Logs'         },
	{ key: 'memberJoinChannel',    name: 'ᴇɴᴛʀʏ-ʟᴏɢs',          label: '<a:tick:1501831530924867695> Entry Logs'        },
	{ key: 'memberLeaveChannel',   name: 'ᴇxɪᴛ-ʟᴏɢs',           label: '<a:tick:1501831530924867695> Exit Logs'         },
	{ key: 'memberBanChannel',     name: 'ʙᴀɴ-ʟᴏɢs',            label: '<a:tick:1501831530924867695> Ban Logs'          },
	{ key: 'memberUnbanChannel',   name: 'ᴜɴʙᴀɴ-ʟᴏɢs',          label: '<a:tick:1501831530924867695> Unban Logs'        },
	{ key: 'memberRoleChannel',    name: 'ᴍᴇᴍʙᴇʀ-ʀᴏʟᴇ-ʟᴏɢs',   label: '<a:tick:1501831530924867695> Member Role Logs' },
	{ key: 'nicknameChannel',      name: 'ɴɪᴄᴋɴᴀᴍᴇ-ʟᴏɢs',       label: '<a:tick:1501831530924867695> Nickname Logs'    },
	{ key: 'rejoinChannel',        name: 'ʀᴇᴊᴏɪɴ-ʟᴏɢs',         label: '<a:tick:1501831530924867695> Rejoin Logs'       },
	{ key: 'roleChannel',          name: 'ʀᴏʟᴇ-ʟᴏɢs',           label: '<a:tick:1501831530924867695> Role Logs'         },
	{ key: 'channelChannel',       name: 'ᴄʜᴀɴɴᴇʟ-ʟᴏɢs',        label: '<a:tick:1501831530924867695> Channel Logs'      },
	{ key: 'voiceChannel',         name: 'ᴠᴄ-ʟᴏɢs',             label: '<a:tick:1501831530924867695> VC Logs'           },
	{ key: 'threadChannel',        name: 'ᴛʜʀᴇᴀᴅ-ʟᴏɢs',         label: '<a:tick:1501831530924867695> Thread Logs'       },
	{ key: 'webhookChannel',       name: 'ᴡᴇʙʜᴏᴏᴋ-ʟᴏɢs',        label: '<a:tick:1501831530924867695> Webhook Logs'      },
	{ key: 'serverChannel',        name: 'sᴇʀᴠᴇʀ-ʟᴏɢs',         label: '<a:tick:1501831530924867695> Server Logs'       },
	{ key: 'inviteChannel',        name: 'ɪɴᴠɪᴛᴇ-ʟᴏɢs',         label: '<a:tick:1501831530924867695> Invite Logs'       },
	{ key: 'modChannel',           name: 'ᴍᴏᴅ-ʟᴏɢs',            label: '<a:tick:1501831530924867695> Mod Logs'          },
	{ key: 'botCommandsChannel',   name: 'ʙᴏᴛ-ᴄᴏᴍᴍᴀɴᴅs',        label: '<a:tick:1501831530924867695> Bot Commands'      },
	{ key: 'autoroleChannel',      name: 'ᴀᴜᴛᴏʀᴏʟᴇ-ʟᴏɢs',       label: '<a:tick:1501831530924867695> Autorole Logs'    },
];

class LoggingCommand extends Command {
	constructor() {
		super({
			name: 'logging',
			description: 'Configure the server logging system',
			usage: 'logging',
			aliases: ['logs', 'log'],
			category: 'Configuration',
			cooldown: 10,
			userPermissions: [PermissionFlagsBits.ManageGuild],
			enabledSlash: false,
		});
	}

	async execute({ ctx }) {
		if (!ctx.guild) return ctx.reply('Server only.');

		const cfg = db.logging.get(ctx.guild.id);
		const isSetup = !!cfg.setupCategoryId;

		if (isSetup) {
			// Already configured — ask what they want to do
			await ctx.reply({ components: [this._renderAlreadySetup(cfg)], flags: MessageFlags.IsComponentsV2 });
		} else {
			// First time — show auto-setup panel
			await ctx.reply({ components: [this._renderSetupPrompt()], flags: MessageFlags.IsComponentsV2 });
		}

		const msg = await ctx.fetchReply();
		this._collect(ctx, msg);
	}

	// ── Render helpers ─────────────────────────────────────────────────────────

	_renderSetupPrompt() {
		const c = new ContainerBuilder().setAccentColor(colors.bot);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
			`## 📋 Logging Setup\n\nSelect a **category** and I'll automatically create all ${LOG_CHANNELS.length} log channels inside it.\n\n-# This only needs to be done once.`
		));
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ChannelSelectMenuBuilder()
				.setCustomId('lg|autosetup|category')
				.setPlaceholder('Select a category for log channels')
				.setChannelTypes([ChannelType.GuildCategory])
				.setMinValues(1).setMaxValues(1),
		));
		return c;
	}

	_renderAlreadySetup(cfg) {
		const category = cfg.setupCategoryId;
		const c = new ContainerBuilder().setAccentColor(colors.warn);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
			`## 📋 Logging Already Configured\n\n**Status:** ${cfg.enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Category:** ${category ? `<#${category}>` : 'Unknown'}\n\nWhat would you like to do?`
		));
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('lg|toggle').setLabel(cfg.enabled ? 'Disable Logging' : 'Enable Logging').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
			new ButtonBuilder().setCustomId('lg|movecategory').setLabel('Move to New Category').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('lg|manual').setLabel('Edit Channels Manually').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('lg|reset').setLabel('Reset & Redo Setup').setStyle(ButtonStyle.Danger),
		));
		return c;
	}

	_renderDashboard(cfg) {
		const c = new ContainerBuilder().setAccentColor(cfg.enabled ? colors.success : colors.error);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
			`## 📋 Logging System\n**Status:** ${cfg.enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Category:** ${cfg.setupCategoryId ? `<#${cfg.setupCategoryId}>` : 'Manual setup'}`
		));
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
		const configured = LOG_CHANNELS.filter(({ key }) => cfg[key]);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
			configured.length
				? configured.map(({ key, label }) => `${label}: <#${cfg[key]}>`).join('\n')
				: 'No channels configured.'
		));
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('lg|toggle').setLabel(cfg.enabled ? 'Disable' : 'Enable').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
			new ButtonBuilder().setCustomId('lg|manual').setLabel('Edit Channels').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('lg|movecategory').setLabel('Move Category').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('lg|reset').setLabel('Reset').setStyle(ButtonStyle.Danger),
		));
		return c;
	}

	_renderManual(cfg) {
		const c = new ContainerBuilder().setAccentColor(colors.bot);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent('## Edit Log Channels\nSelect a log type to change its channel:'));
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId('lg|manual|type')
				.setPlaceholder('Choose log type')
				.addOptions(LOG_CHANNELS.slice(0, 25).map(({ key, label }) => ({
					label: label.replace(/^\S+\s/, ''),
					description: cfg[key] ? `Currently: #${key}` : 'Not set',
					value: key,
				}))),
		));
		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('lg|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
		));
		return c;
	}

	// ── Collector ──────────────────────────────────────────────────────────────

	_collect(ctx, msg) {
		const col = msg.createMessageComponentCollector({
			time: 300_000,
			filter: i => {
				if (i.user.id !== ctx.author.id) {
					i.reply({ content: `${emoji.cross} Not yours.`, flags: MessageFlags.Ephemeral });
					return false;
				}
				return true;
			},
		});

		autoDisable(col, msg);

		col.on('collect', async i => {
			try { await this._handle(ctx, msg, i); }
			catch (e) { logger.error('Logging', e.message); }
		});
	}

	// ── Handler ────────────────────────────────────────────────────────────────

	async _handle(ctx, msg, i) {
		const parts = i.customId.split('|');
		const action = parts[1];
		const sub = parts[2];
		const guildId = ctx.guild.id;

		// ── Auto-setup: category selected ──────────────────────────────────────
		if (action === 'autosetup' && sub === 'category') {
			const categoryId = i.values[0];
			await i.deferUpdate();

			const progress = new ContainerBuilder().setAccentColor(colors.bot);
			progress.addTextDisplayComponents(new TextDisplayBuilder().setContent(
				`## ⏳ Creating Log Channels...\nCreating ${LOG_CHANNELS.length} channels in <#${categoryId}>...`
			));
			await msg.edit({ components: [progress] });

			await this._autoSetup(ctx.guild, categoryId, guildId);

			const cfg = db.logging.get(guildId);
			return msg.edit({ components: [this._renderDashboard(cfg)] });
		}

		// ── Move to new category ───────────────────────────────────────────────
		if (action === 'movecategory' && !sub) {
			await i.deferUpdate();
			const c = new ContainerBuilder().setAccentColor(colors.bot);
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
				`## 📁 Move Log Channels\nSelect a new category to move all log channels into:`
			));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ChannelSelectMenuBuilder()
					.setCustomId('lg|movecategory|select')
					.setPlaceholder('Select new category')
					.setChannelTypes([ChannelType.GuildCategory])
					.setMinValues(1).setMaxValues(1),
			));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('lg|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
			));
			return msg.edit({ components: [c] });
		}

		if (action === 'movecategory' && sub === 'select') {
			const newCategoryId = i.values[0];
			await i.deferUpdate();

			const progress = new ContainerBuilder().setAccentColor(colors.bot);
			progress.addTextDisplayComponents(new TextDisplayBuilder().setContent(
				`## ⏳ Moving Channels...\nMoving all log channels to <#${newCategoryId}>...`
			));
			await msg.edit({ components: [progress] });

			await this._moveChannels(ctx.guild, guildId, newCategoryId);

			const cfg = db.logging.get(guildId);
			return msg.edit({ components: [this._renderDashboard(cfg)] });
		}

		// ── Toggle ─────────────────────────────────────────────────────────────
		if (action === 'toggle') {
			await i.deferUpdate();
			const cfg = db.logging.get(guildId);
			db.logging.setEnabled(guildId, !cfg.enabled);
			return msg.edit({ components: [this._renderDashboard(db.logging.get(guildId))] });
		}

		// ── Reset ──────────────────────────────────────────────────────────────
		if (action === 'reset') {
			await i.deferUpdate();
			const reset = { setupCategoryId: null, enabled: false };
			for (const { key } of LOG_CHANNELS) reset[key] = null;
			db.logging.set(guildId, reset);
			return msg.edit({ components: [this._renderSetupPrompt()] });
		}

		// ── Manual edit ────────────────────────────────────────────────────────
		if (action === 'manual' && !sub) {
			await i.deferUpdate();
			return msg.edit({ components: [this._renderManual(db.logging.get(guildId))] });
		}

		if (action === 'manual' && sub === 'type') {
			await i.deferUpdate();
			const key = i.values[0];
			const entry = LOG_CHANNELS.find(l => l.key === key);
			const cfg = db.logging.get(guildId);
			const c = new ContainerBuilder().setAccentColor(colors.bot);
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
				`**${entry?.label ?? key}**\nCurrent: ${cfg[key] ? `<#${cfg[key]}>` : 'Not set'}\n\nSelect a channel:`
			));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ChannelSelectMenuBuilder()
					.setCustomId(`lg|manual|channel|${key}`)
					.setChannelTypes([ChannelType.GuildText])
					.setMinValues(0).setMaxValues(1),
			));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('lg|manual').setLabel('← Back').setStyle(ButtonStyle.Secondary),
			));
			return msg.edit({ components: [c] });
		}

		if (action === 'manual' && sub === 'channel') {
			await i.deferUpdate();
			const key = parts[3];
			db.logging.set(guildId, { [key]: i.values[0] ?? null });
			return msg.edit({ components: [this._renderManual(db.logging.get(guildId))] });
		}

		// ── Back ───────────────────────────────────────────────────────────────
		if (action === 'back') {
			await i.deferUpdate();
			return msg.edit({ components: [this._renderDashboard(db.logging.get(guildId))] });
		}
	}

	// ── Auto-setup: create all channels in category ────────────────────────────

	async _autoSetup(guild, categoryId, guildId) {
		const botMember = guild.members.me;
		const updates = { setupCategoryId: categoryId, enabled: true };

		for (const { key, name } of LOG_CHANNELS) {
			try {
				// Check if channel with this name already exists in the category
				const existing = guild.channels.cache.find(
					ch => ch.parentId === categoryId && ch.name === name && ch.isTextBased()
				);

				if (existing) {
					updates[key] = existing.id;
				} else {
					const created = await guild.channels.create({
						name,
						type: ChannelType.GuildText,
						parent: categoryId,
						permissionOverwrites: [
							// Only bot can see log channels
							{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
							{ id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
						],
						reason: '[Logging] Auto-setup',
					});
					updates[key] = created.id;
				}
			} catch (e) {
				logger.error('Logging', `Failed to create channel ${name}: ${e.message}`);
			}
		}

		db.logging.set(guildId, updates);
	}

	// ── Move all existing log channels to a new category ──────────────────────

	async _moveChannels(guild, guildId, newCategoryId) {
		const cfg = db.logging.get(guildId);

		for (const { key } of LOG_CHANNELS) {
			const channelId = cfg[key];
			if (!channelId) continue;
			const channel = guild.channels.cache.get(channelId);
			if (!channel) continue;
			await channel.setParent(newCategoryId, { lockPermissions: false, reason: '[Logging] Category move' }).catch(() => {});
		}

		db.logging.set(guildId, { setupCategoryId: newCategoryId });
	}
}

export default new LoggingCommand();
