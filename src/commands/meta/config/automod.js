import { Command } from '#command';
import {
	PermissionFlagsBits, MessageFlags, ButtonStyle,
	ActionRowBuilder, ButtonBuilder, ContainerBuilder,
	TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
	ModalBuilder, TextInputBuilder, TextInputStyle,
	StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType,
} from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';
import { emoji } from '#emoji';
import { InteractionRouter } from '#classes/interactionRouter';
import { NativeAutomod } from '#classes/nativeAutomod';
import { autoDisable, disableComponents, logger } from '#utils';

const { colors } = config;

const ACTION_LABELS = { delete: '🗑️ Delete', mute: '🔇 Mute', kick: '👢 Kick', ban: '🔨 Ban' };

class AutomodCommand extends Command {
	constructor() {
		super({
			name: 'automod',
			description: 'Configure the automod system',
			usage: 'automod',
			aliases: ['am', 'automoderation'],
			category: 'Configuration',
			cooldown: 10,
			examples: ['automod'],
			userPermissions: [PermissionFlagsBits.ManageGuild],
			enabledSlash: true,
			slashData: {
				name: 'automod',
				description: 'Configure the automod system',
				defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
			},
		});

		// Register global handler for persistent buttons and modals
		InteractionRouter.register('am', async (i) => {
			const ctx = { guild: i.guild, author: i.user, client: i.client, user: i.user, member: i.member };
			const msg = i.message; 
			await this._handle(ctx, msg, i);
		});
	}

	async execute({ ctx }) {
		if (!ctx.guild) return ctx.reply('This command is only available in servers.');
		const cfg = db.automod.get(ctx.guild.id);
		await ctx.reply({ components: [this._renderMain(cfg)], flags: MessageFlags.IsComponentsV2 });
	}

	// ── Render helpers ─────────────────────────────────────────────────────────

	_renderMain(cfg) {
		const c = new ContainerBuilder().setAccentColor(cfg.enabled ? colors.success : colors.error);
		
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 🛡️ Automod Neural Network'));
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent('Advanced heuristic analysis and message filtering.'));
		
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

		const on = '<a:Online:1501899980405997579>';
		const off = '<a:reddot:1501900034478964838>';
		const status = (e) => e ? on : off;

		c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
			`### ⚙️ Global Configuration`,
			`**System Status:** ${status(cfg.enabled)} ${cfg.enabled ? 'Active' : 'Deactivated'}`,
			`**Log Channel:** ${cfg.logChannel ? `<#${cfg.logChannel}>` : 'Not set'}`,
			'',
			`### 🧩 Filtering Modules`,
			`| ${status(cfg.antiSpamEnabled)} Spam | ${status(cfg.antiMentionEnabled)} Mention | ${status(cfg.antiLinkEnabled)} Link | ${status(cfg.antiInviteEnabled)} Invite |`,
			`| ${status(cfg.antiCapsEnabled)} Caps | ${status(cfg.antiEmojiEnabled)} Emoji | ${status(cfg.wordFilterEnabled)} Words |`,
		].join('\n')));

		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('am|toggle').setLabel(cfg.enabled ? 'Deactivate' : 'Activate').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
			new ButtonBuilder().setCustomId('am|logchannel').setLabel('Log Channel').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('am|whitelist').setLabel('Whitelist').setStyle(ButtonStyle.Secondary),
		));

		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('am|spam').setLabel('Anti-Spam').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('am|mention').setLabel('Anti-Mention').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('am|link').setLabel('Anti-Link').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('am|invite').setLabel('Anti-Invite').setStyle(ButtonStyle.Primary),
		));

		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('am|caps').setLabel('Anti-Caps').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('am|emoji').setLabel('Anti-Emoji').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('am|words').setLabel('Word Filter').setStyle(ButtonStyle.Primary),
		));

		return c;
	}

	_renderModule(cfg, module, title, fields, feedback = null) {
		const enabled = cfg[`${module}Enabled`];
		const c = new ContainerBuilder().setAccentColor(enabled ? colors.success : colors.error);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`));
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

		const lines = fields.map(([label, val]) => `**${label}:** ${val}`);
		if (feedback) lines.push('', feedback);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId(`am|${module}|toggle`).setLabel(enabled ? 'Disable' : 'Enable').setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success),
			new ButtonBuilder().setCustomId(`am|${module}|config`).setLabel('Configure').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('am|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
		));
		return c;
	}

	// ── Collector ──────────────────────────────────────────────────────────────

	async _handle(ctx, msg, i) {
		const parts = i.customId.split('|');
		const [, action, sub] = parts;
		const guildId = ctx.guild.id;

		// 1. Handle Modals
		if (i.isModalSubmit()) {
			if (i.customId.startsWith('am|modal|')) {
				await i.deferUpdate().catch(() => {});
				const mod = i.customId.split('|')[2];
				const updates = this._parseModalSubmit(i, mod);
				db.automod.set(guildId, updates);
				await NativeAutomod.sync(ctx.guild).catch(() => {});
				
				const TITLE_MAP = {
					antiSpam: '🚫 Anti-Spam', antiMention: '📢 Anti-Mention', antiLink: '🔗 Anti-Link',
					antiInvite: '📨 Anti-Invite', antiCaps: '🔠 Anti-Caps', antiEmoji: '😂 Anti-Emoji', wordFilter: '🤬 Word Filter',
				};
				return msg.edit({ 
					components: [this._renderModulePage(db.automod.get(guildId), mod, TITLE_MAP[mod])],
					flags: MessageFlags.IsComponentsV2
				}).catch(() => {});
			}
			return;
		}

		// Security: Only allow administrators
		if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
			return i.reply({ content: `${emoji.get('cross')} This control panel is only for server managers.`, flags: MessageFlags.Ephemeral });
		}

		// Back to main
		if (action === 'back') {
			await i.deferUpdate();
			return msg.edit({ components: [this._renderMain(db.automod.get(guildId))] });
		}

		// Global toggle
		if (action === 'toggle') {
			await i.deferUpdate();
			const cfg = db.automod.get(guildId);
			db.automod.setEnabled(guildId, !cfg.enabled);
			await NativeAutomod.sync(ctx.guild).catch(() => {});
			return msg.edit({ components: [this._renderMain(db.automod.get(guildId))] });
		}

		// Log channel picker
		if (action === 'logchannel' && !sub) {
			await i.deferUpdate();
			const c = new ContainerBuilder().setAccentColor(colors.bot);
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent('## Log Channel\nSelect a channel to send automod logs to.'));
			c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ChannelSelectMenuBuilder().setCustomId('am|logchannel|select')
					.setPlaceholder('Pick a log channel')
					.setChannelTypes([ChannelType.GuildText])
					.setMinValues(0).setMaxValues(1),
			));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('am|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
			));
			return msg.edit({ components: [c] });
		}

		if (action === 'logchannel' && sub === 'select') {
			await i.deferUpdate();
			db.automod.setLogChannel(guildId, i.values[0] ?? null);
			return msg.edit({ components: [this._renderMain(db.automod.get(guildId))] });
		}

		// Whitelist
		if (action === 'whitelist' && !sub) {
			await i.deferUpdate();
			const cfg = db.automod.get(guildId);
			const c = new ContainerBuilder().setAccentColor(colors.bot);
			const roles = (cfg.whitelistedRoles ?? []).map(r => `<@&${r}>`).join(' ') || 'None';
			const channels = (cfg.whitelistedChannels ?? []).map(ch => `<#${ch}>`).join(' ') || 'None';
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Whitelist\n**Roles:** ${roles}\n**Channels:** ${channels}\n\n-# Whitelisted roles/channels bypass all automod checks.`));
			c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('am|whitelist|addrole').setLabel('Add Role').setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId('am|whitelist|addchannel').setLabel('Add Channel').setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId('am|whitelist|clear').setLabel('Clear All').setStyle(ButtonStyle.Danger),
				new ButtonBuilder().setCustomId('am|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
			));
			return msg.edit({ components: [c] });
		}

		// Module pages
		const MODULE_MAP = {
			spam: ['antiSpam', '🚫 Anti-Spam'],
			mention: ['antiMention', '📢 Anti-Mention'],
			link: ['antiLink', '🔗 Anti-Link'],
			invite: ['antiInvite', '📨 Anti-Invite'],
			caps: ['antiCaps', '🔠 Anti-Caps'],
			emoji: ['antiEmoji', '😂 Anti-Emoji'],
			words: ['wordFilter', '🤬 Word Filter'],
		};

		if (MODULE_MAP[action] && !sub) {
			await i.deferUpdate();
			const [mod, title] = MODULE_MAP[action];
			const cfg = db.automod.get(guildId);
			return msg.edit({ components: [this._renderModulePage(cfg, mod, title)] });
		}

		// Module toggle
		if (MODULE_MAP[action] && sub === 'toggle') {
			await i.deferUpdate();
			const [mod, title] = MODULE_MAP[action];
			const cfg = db.automod.get(guildId);
			db.automod.set(guildId, { [`${mod}Enabled`]: !cfg[`${mod}Enabled`] });
			await NativeAutomod.sync(ctx.guild).catch(() => {});
			return msg.edit({ components: [this._renderModulePage(db.automod.get(guildId), mod, title)] });
		}

		// Module configure (modal)
		if (MODULE_MAP[action] && sub === 'config') {
			const [mod] = MODULE_MAP[action];
			await this._showConfigModal(i, msg, ctx, guildId, mod, action);
			return;
		}

		// Whitelist sub-actions
		if (action === 'whitelist' && sub) {
			if (sub === 'clear') {
				await i.deferUpdate();
				db.automod.set(guildId, { whitelistedRoles: [], whitelistedChannels: [] });
				return msg.edit({ components: [this._renderMain(db.automod.get(guildId))] });
			}
			if (sub === 'addrole') {
				await i.deferUpdate();
				const c = new ContainerBuilder().setAccentColor(colors.bot);
				c.addTextDisplayComponents(new TextDisplayBuilder().setContent('Select a role to whitelist:'));
				c.addActionRowComponents(new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder().setCustomId('am|whitelist|roleselect')
						.setPlaceholder('Pick a role')
						.addOptions(
							ctx.guild.roles.cache
								.filter(r => !r.managed && r.id !== ctx.guild.id)
								.first(25)
								.map(r => ({ label: r.name, value: r.id })),
						),
				));
				c.addActionRowComponents(new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('am|whitelist').setLabel('← Back').setStyle(ButtonStyle.Secondary),
				));
				return msg.edit({ components: [c] });
			}
			if (sub === 'addchannel') {
				await i.deferUpdate();
				const c = new ContainerBuilder().setAccentColor(colors.bot);
				c.addTextDisplayComponents(new TextDisplayBuilder().setContent('Select a channel to whitelist:'));
				c.addActionRowComponents(new ActionRowBuilder().addComponents(
					new ChannelSelectMenuBuilder().setCustomId('am|whitelist|channelselect')
						.setPlaceholder('Pick a channel')
						.setChannelTypes([ChannelType.GuildText])
						.setMinValues(1).setMaxValues(1),
				));
				c.addActionRowComponents(new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('am|whitelist').setLabel('← Back').setStyle(ButtonStyle.Secondary),
				));
				return msg.edit({ components: [c] });
			}
			if (sub === 'roleselect') {
				await i.deferUpdate();
				for (const roleId of i.values) db.automod.addWhitelistedRole(guildId, roleId);
				return msg.edit({ components: [this._renderMain(db.automod.get(guildId))] });
			}
			if (sub === 'channelselect') {
				await i.deferUpdate();
				for (const chId of i.values) db.automod.addWhitelistedChannel(guildId, chId);
				return msg.edit({ components: [this._renderMain(db.automod.get(guildId))] });
			}
		}

		// Log channel select (from channel select menu)
		if (action === 'logchannel' && sub === 'select') {
			await i.deferUpdate();
			db.automod.setLogChannel(guildId, i.values[0] ?? null);
			return msg.edit({ components: [this._renderMain(db.automod.get(guildId))] });
		}
	}

	_renderModulePage(cfg, mod, title) {
		const enabled = cfg[`${mod}Enabled`];
		const c = new ContainerBuilder().setAccentColor(enabled ? colors.success : colors.error);
		
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`));
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

		const on = '<a:Online:1501899980405997579>';
		const off = '<a:reddot:1501900034478964838>';
		const status = (e) => e ? on : off;

		const fields = this._moduleFields(cfg, mod).map(([k, v]) => {
			if (k === 'Status') return `**Status:** ${v.includes('Enabled') ? on : off} ${v}`;
			return `**${k}:** ${v}`;
		});
		
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(fields.join('\n')));
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

		// Map mod name back to action key
		const actionKey = {
			antiSpam: 'spam', antiMention: 'mention', antiLink: 'link',
			antiInvite: 'invite', antiCaps: 'caps', antiEmoji: 'emoji', wordFilter: 'words',
		}[mod];

		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId(`am|${actionKey}|toggle`).setLabel(enabled ? 'Disable' : 'Enable').setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success),
			new ButtonBuilder().setCustomId(`am|${actionKey}|config`).setLabel('Configure').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('am|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
		));
		return c;
	}

	_moduleFields(cfg, mod) {
		switch (mod) {
			case 'antiSpam': return [
				['Status', cfg.antiSpamEnabled ? '🟢 Enabled' : '🔴 Disabled'],
				['Limit', `${cfg.antiSpamLimit} messages`],
				['Interval', `${cfg.antiSpamInterval / 1000}s`],
				['Action', ACTION_LABELS[cfg.antiSpamAction] ?? cfg.antiSpamAction],
			];
			case 'antiMention': return [
				['Status', cfg.antiMentionEnabled ? '🟢 Enabled' : '🔴 Disabled'],
				['Limit', `${cfg.antiMentionLimit} mentions per message`],
				['Action', ACTION_LABELS[cfg.antiMentionAction] ?? cfg.antiMentionAction],
			];
			case 'antiLink': return [
				['Status', cfg.antiLinkEnabled ? '🟢 Enabled' : '🔴 Disabled'],
				['Action', ACTION_LABELS[cfg.antiLinkAction] ?? cfg.antiLinkAction],
				['Whitelist', (cfg.antiLinkWhitelist ?? []).join(', ') || 'None'],
			];
			case 'antiInvite': return [
				['Status', cfg.antiInviteEnabled ? '🟢 Enabled' : '🔴 Disabled'],
				['Action', ACTION_LABELS[cfg.antiInviteAction] ?? cfg.antiInviteAction],
			];
			case 'antiCaps': return [
				['Status', cfg.antiCapsEnabled ? '🟢 Enabled' : '🔴 Disabled'],
				['Threshold', `${cfg.antiCapsThreshold}%`],
				['Min Length', `${cfg.antiCapsMinLength} chars`],
				['Action', ACTION_LABELS[cfg.antiCapsAction] ?? cfg.antiCapsAction],
			];
			case 'antiEmoji': return [
				['Status', cfg.antiEmojiEnabled ? '🟢 Enabled' : '🔴 Disabled'],
				['Limit', `${cfg.antiEmojiLimit} emojis per message`],
				['Action', ACTION_LABELS[cfg.antiEmojiAction] ?? cfg.antiEmojiAction],
			];
			case 'wordFilter': return [
				['Status', cfg.wordFilterEnabled ? '🟢 Enabled' : '🔴 Disabled'],
				['Words', cfg.wordFilterList?.length ? `${cfg.wordFilterList.length} word(s)` : 'None'],
				['Action', ACTION_LABELS[cfg.wordFilterAction] ?? cfg.wordFilterAction],
			];
			default: return [];
		}
	}

	async _showConfigModal(i, msg, ctx, guildId, mod, actionKey) {
		const cfg = db.automod.get(guildId);
		const modalId = `am|modal|${mod}`;
		const modal = new ModalBuilder().setCustomId(modalId).setTitle(`Configure ${mod}`);

		const inputs = this._modalInputs(cfg, mod);
		for (const input of inputs) {
			modal.addComponents(new ActionRowBuilder().addComponents(input));
		}

		await i.showModal(modal);
	}

	_modalInputs(cfg, mod) {
		const ACTIONS = 'delete, mute, kick, ban';
		switch (mod) {
			case 'antiSpam': return [
				new TextInputBuilder().setCustomId('limit').setLabel('Message limit (e.g. 5)').setStyle(TextInputStyle.Short).setValue(String(cfg.antiSpamLimit)).setRequired(true),
				new TextInputBuilder().setCustomId('interval').setLabel('Time window in seconds (e.g. 5)').setStyle(TextInputStyle.Short).setValue(String(cfg.antiSpamInterval / 1000)).setRequired(true),
				new TextInputBuilder().setCustomId('action').setLabel('Action (delete/mute/kick/ban)').setStyle(TextInputStyle.Short).setValue(cfg.antiSpamAction).setRequired(true),
			];
			case 'antiMention': return [
				new TextInputBuilder().setCustomId('limit').setLabel('Max mentions per message').setStyle(TextInputStyle.Short).setValue(String(cfg.antiMentionLimit)).setRequired(true),
				new TextInputBuilder().setCustomId('action').setLabel('Action (delete/mute/kick/ban)').setStyle(TextInputStyle.Short).setValue(cfg.antiMentionAction).setRequired(true),
			];
			case 'antiLink': return [
				new TextInputBuilder().setCustomId('whitelist').setLabel('Allowed domains (space-separated)').setStyle(TextInputStyle.Short).setValue((cfg.antiLinkWhitelist ?? []).join(' ')).setRequired(false),
				new TextInputBuilder().setCustomId('action').setLabel('Action (delete/mute/kick/ban)').setStyle(TextInputStyle.Short).setValue(cfg.antiLinkAction).setRequired(true),
			];
			case 'antiInvite': return [
				new TextInputBuilder().setCustomId('action').setLabel('Action (delete/mute/kick/ban)').setStyle(TextInputStyle.Short).setValue(cfg.antiInviteAction).setRequired(true),
			];
			case 'antiCaps': return [
				new TextInputBuilder().setCustomId('threshold').setLabel('Caps threshold % (e.g. 70)').setStyle(TextInputStyle.Short).setValue(String(cfg.antiCapsThreshold)).setRequired(true),
				new TextInputBuilder().setCustomId('minlength').setLabel('Min message length (e.g. 10)').setStyle(TextInputStyle.Short).setValue(String(cfg.antiCapsMinLength)).setRequired(true),
				new TextInputBuilder().setCustomId('action').setLabel('Action (delete/mute/kick/ban)').setStyle(TextInputStyle.Short).setValue(cfg.antiCapsAction).setRequired(true),
			];
			case 'antiEmoji': return [
				new TextInputBuilder().setCustomId('limit').setLabel('Max emojis per message').setStyle(TextInputStyle.Short).setValue(String(cfg.antiEmojiLimit)).setRequired(true),
				new TextInputBuilder().setCustomId('action').setLabel('Action (delete/mute/kick/ban)').setStyle(TextInputStyle.Short).setValue(cfg.antiEmojiAction).setRequired(true),
			];
			case 'wordFilter': return [
				new TextInputBuilder().setCustomId('words').setLabel('Banned words (space-separated)').setStyle(TextInputStyle.Paragraph).setValue((cfg.wordFilterList ?? []).join(' ')).setRequired(false),
				new TextInputBuilder().setCustomId('action').setLabel('Action (delete/mute/kick/ban)').setStyle(TextInputStyle.Short).setValue(cfg.wordFilterAction).setRequired(true),
			];
			default: return [];
		}
	}

	_parseModalSubmit(submit, mod) {
		const VALID_ACTIONS = ['delete', 'mute', 'kick', 'ban'];
		const action = (key) => {
			const val = submit.fields.getTextInputValue(key)?.trim().toLowerCase();
			return VALID_ACTIONS.includes(val) ? val : 'delete';
		};
		const int = (key, fallback) => {
			const val = parseInt(submit.fields.getTextInputValue(key), 10);
			return isNaN(val) || val < 1 ? fallback : val;
		};

		switch (mod) {
			case 'antiSpam': return {
				antiSpamLimit: int('limit', 5),
				antiSpamInterval: int('interval', 5) * 1000,
				antiSpamAction: action('action'),
			};
			case 'antiMention': return {
				antiMentionLimit: int('limit', 5),
				antiMentionAction: action('action'),
			};
			case 'antiLink': return {
				antiLinkWhitelist: (submit.fields.getTextInputValue('whitelist') ?? '').trim().split(/\s+/).filter(Boolean),
				antiLinkAction: action('action'),
			};
			case 'antiInvite': return { antiInviteAction: action('action') };
			case 'antiCaps': return {
				antiCapsThreshold: Math.min(100, Math.max(1, int('threshold', 70))),
				antiCapsMinLength: int('minlength', 10),
				antiCapsAction: action('action'),
			};
			case 'antiEmoji': return {
				antiEmojiLimit: int('limit', 10),
				antiEmojiAction: action('action'),
			};
			case 'wordFilter': return {
				wordFilterList: (submit.fields.getTextInputValue('words') ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean),
				wordFilterAction: action('action'),
			};
			default: return {};
		}
	}
}

export default new AutomodCommand();
