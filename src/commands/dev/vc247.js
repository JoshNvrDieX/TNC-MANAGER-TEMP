import { Command } from '#command';
import {
	PermissionFlagsBits, MessageFlags, ButtonStyle, ChannelType,
	ActionRowBuilder, ButtonBuilder, ContainerBuilder,
	TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
	ChannelSelectMenuBuilder, StringSelectMenuBuilder,
	ModalBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { VC247Manager } from '#classes/vc247Manager';
import { StatusManager } from '#classes/statusManager';
import { config } from '#config';
import { emoji } from '#emoji';
import { disableComponents, logger } from '#utils';

const { colors } = config;

const STATUS_TYPES = ['CUSTOM', 'PLAYING', 'WATCHING', 'LISTENING', 'COMPETING'];

class VC247Command extends Command {
	constructor() {
		super({
			name: 'vc247',
			description: 'Configure 24/7 VC and bot status',
			usage: 'vc247',
			aliases: ['247', 'voice', 'status'],
			category: 'developer',
			cooldown: 5,
			ownerOnly: true,
			enabledSlash: true,
			slashData: {
				name: 'vc247',
				description: 'Configure 24/7 VC and bot status',
				defaultMemberPermissions: PermissionFlagsBits.Administrator,
			},
		});
	}

	async execute({ ctx }) {
		if (!ctx.guild) return ctx.reply('Server only.');
		await ctx.reply({ components: [this._renderVC(ctx.guild)], flags: MessageFlags.IsComponentsV2 });
		const msg = await ctx.fetchReply();
		this._collect(ctx, msg);
	}

	// ── Renders ────────────────────────────────────────────────────────────────

	_renderVC(guild) {
		const cfg = VC247Manager.getConfig(guild.id);
		const c = new ContainerBuilder().setAccentColor(cfg.enabled ? colors.success : colors.error);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
			`## 🔊 24/7 Voice Channel`,
			`**Status:** ${cfg.enabled ? '🟢 Active' : '🔴 Inactive'}`,
			`**Channel:** ${cfg.channelId ? `<#${cfg.channelId}>` : 'Not set'}`,
			`**Channel Status:** ${cfg.channelStatus ? `\`${cfg.channelStatus}\`` : 'Not set'}`,
			``,
			`-# Bot will auto-reconnect if kicked or disconnected.`,
		].join('\n')));
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('vc|toggle').setLabel(cfg.enabled ? 'Disable' : 'Enable').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
			new ButtonBuilder().setCustomId('vc|setchannel').setLabel('Set Channel').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('vc|setchstatus').setLabel('Set VC Status').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('vc|status').setLabel('⚙️ Bot Status').setStyle(ButtonStyle.Secondary),
		));
		return c;
	}

	_renderStatus() {
		const cfg = StatusManager.getConfig();
		const c = new ContainerBuilder().setAccentColor(cfg.enabled ? colors.success : colors.error);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
			`## 🎭 Bot Status`,
			`**Rotation:** ${cfg.enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
			`**Type:** \`${cfg.type}\``,
			`**Interval:** ${cfg.intervalSeconds}s`,
			`**Statuses (${cfg.texts.length}):**`,
			cfg.texts.map((t, i) => `\`${i + 1}.\` ${t}`).join('\n') || 'None set',
		].join('\n')));
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('st|toggle').setLabel(cfg.enabled ? 'Disable' : 'Enable').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
			new ButtonBuilder().setCustomId('st|settype').setLabel('Set Type').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('st|edit').setLabel('Edit Statuses').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('st|interval').setLabel('Set Interval').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('vc|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
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
		col.on('collect', async i => {
			try { await this._handle(ctx, msg, i); }
			catch (e) { logger.error('VC247', e.message); }
		});
		col.on('end', async () => { try { await disableComponents(msg); } catch {} });
	}

	// ── Handler ────────────────────────────────────────────────────────────────

	async _handle(ctx, msg, i) {
		const [ns, action] = i.customId.split('|');

		// ── VC namespace ───────────────────────────────────────────────────────
		if (ns === 'vc') {
			if (action === 'back') {
				await i.deferUpdate();
				return msg.edit({ components: [this._renderVC(ctx.guild)] });
			}

			if (action === 'toggle') {
				await i.deferUpdate();
				const cfg = VC247Manager.getConfig(ctx.guild.id);
				if (cfg.enabled) {
					await VC247Manager.leave(ctx.guild);
				} else {
					VC247Manager.setConfig(ctx.guild.id, { enabled: true });
					await VC247Manager.join(ctx.guild);
				}
				return msg.edit({ components: [this._renderVC(ctx.guild)] });
			}

			if (action === 'setchstatus') {
				const cfg = VC247Manager.getConfig(ctx.guild.id);
				const modal = new ModalBuilder()
					.setCustomId(`vc_chstatus_${i.id}`)
					.setTitle('Set Voice Channel Status');
				modal.addComponents(
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId('status')
							.setLabel('Channel status text (leave blank to clear)')
							.setStyle(TextInputStyle.Short)
							.setValue(cfg.channelStatus ?? '')
							.setRequired(false)
							.setMaxLength(500),
					),
				);
				await i.showModal(modal);
				try {
					const submit = await i.awaitModalSubmit({ filter: s => s.customId === `vc_chstatus_${i.id}`, time: 60_000 });
					await submit.deferUpdate();
					const statusText = submit.fields.getTextInputValue('status').trim() || null;
					const channelId = cfg.channelId;
					if (!channelId) {
						return msg.edit({ components: [this._renderVC(ctx.guild)] });
					}
					await VC247Manager.setChannelStatus(ctx.guild, channelId, statusText);
					return msg.edit({ components: [this._renderVC(ctx.guild)] });
				} catch {}
				return;
			}

			if (action === 'setchannel') {
				await i.deferUpdate();
				const c = new ContainerBuilder().setAccentColor(colors.bot);
				c.addTextDisplayComponents(new TextDisplayBuilder().setContent('Select a voice channel to stay in 24/7:'));
				c.addActionRowComponents(new ActionRowBuilder().addComponents(
					new ChannelSelectMenuBuilder()
						.setCustomId('vc|channelselect')
						.setPlaceholder('Pick a voice channel')
						.setChannelTypes([ChannelType.GuildVoice, ChannelType.GuildStageVoice])
						.setMinValues(1).setMaxValues(1),
				));
				c.addActionRowComponents(new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('vc|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
				));
				return msg.edit({ components: [c] });
			}

			if (action === 'channelselect') {
				await i.deferUpdate();
				const channelId = i.values[0];
				VC247Manager.setConfig(ctx.guild.id, { channelId, enabled: true });
				await VC247Manager.join(ctx.guild);
				return msg.edit({ components: [this._renderVC(ctx.guild)] });
			}

			if (action === 'status') {
				await i.deferUpdate();
				return msg.edit({ components: [this._renderStatus()] });
			}
		}

		// ── Status namespace ───────────────────────────────────────────────────
		if (ns === 'st') {
			if (action === 'toggle') {
				await i.deferUpdate();
				const cfg = StatusManager.getConfig();
				StatusManager.setConfig({ enabled: !cfg.enabled });
				StatusManager.restart(ctx.client);
				return msg.edit({ components: [this._renderStatus()] });
			}

			if (action === 'settype') {
				await i.deferUpdate();
				const c = new ContainerBuilder().setAccentColor(colors.bot);
				c.addTextDisplayComponents(new TextDisplayBuilder().setContent('Select status type:'));
				c.addActionRowComponents(new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId('st|typeselect')
						.setPlaceholder('Choose type')
						.addOptions(STATUS_TYPES.map(t => ({ label: t, value: t }))),
				));
				c.addActionRowComponents(new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('vc|status').setLabel('← Back').setStyle(ButtonStyle.Secondary),
				));
				return msg.edit({ components: [c] });
			}

			if (action === 'typeselect') {
				await i.deferUpdate();
				StatusManager.setConfig({ type: i.values[0] });
				StatusManager.restart(ctx.client);
				return msg.edit({ components: [this._renderStatus()] });
			}

			if (action === 'edit') {
				const modal = new ModalBuilder()
					.setCustomId(`st_edit_${i.id}`)
					.setTitle('Edit Bot Statuses');
				modal.addComponents(
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId('statuses')
							.setLabel('One status per line (max 10)')
							.setStyle(TextInputStyle.Paragraph)
							.setValue(StatusManager.getConfig().texts.join('\n'))
							.setRequired(true)
							.setMaxLength(1000),
					),
				);
				await i.showModal(modal);
				try {
					const submit = await i.awaitModalSubmit({ filter: s => s.customId === `st_edit_${i.id}`, time: 120_000 });
					await submit.deferUpdate();
					const texts = submit.fields.getTextInputValue('statuses')
						.split('\n').map(t => t.trim()).filter(Boolean).slice(0, 10);
					StatusManager.setConfig({ texts, currentIndex: 0 });
					StatusManager.restart(ctx.client);
					return msg.edit({ components: [this._renderStatus()] });
				} catch {}
				return;
			}

			if (action === 'interval') {
				const modal = new ModalBuilder()
					.setCustomId(`st_interval_${i.id}`)
					.setTitle('Set Rotation Interval');
				modal.addComponents(
					new ActionRowBuilder().addComponents(
						new TextInputBuilder()
							.setCustomId('seconds')
							.setLabel('Interval in seconds (min 10)')
							.setStyle(TextInputStyle.Short)
							.setValue(String(StatusManager.getConfig().intervalSeconds))
							.setRequired(true),
					),
				);
				await i.showModal(modal);
				try {
					const submit = await i.awaitModalSubmit({ filter: s => s.customId === `st_interval_${i.id}`, time: 60_000 });
					await submit.deferUpdate();
					const secs = Math.max(10, parseInt(submit.fields.getTextInputValue('seconds'), 10) || 30);
					StatusManager.setConfig({ intervalSeconds: secs });
					StatusManager.restart(ctx.client);
					return msg.edit({ components: [this._renderStatus()] });
				} catch {}
				return;
			}
		}
	}
}

export default new VC247Command();
