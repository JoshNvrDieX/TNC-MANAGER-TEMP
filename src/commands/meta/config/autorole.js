import { Command } from '#command';
import {
	PermissionFlagsBits, MessageFlags, ButtonStyle,
	ActionRowBuilder, ButtonBuilder, ContainerBuilder,
	TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
	RoleSelectMenuBuilder,
} from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';
import { emoji } from '#emoji';
import { autoDisable, disableComponents, logger } from '#utils';

const { colors } = config;

class AutoroleCommand extends Command {
	constructor() {
		super({
			name: 'autorole',
			description: 'Configure auto-role on member/bot join',
			usage: 'autorole',
			aliases: ['ar'],
			category: 'Configuration',
			cooldown: 10,
			userPermissions: [PermissionFlagsBits.ManageGuild],
			enabledSlash: false,
		});
	}

	async execute({ ctx }) {
		if (!ctx.guild) return ctx.reply('Server only.');
		const cfg = db.autorole.get(ctx.guild.id);
		await ctx.reply({ components: [this._render(cfg)], flags: MessageFlags.IsComponentsV2 });
		const msg = await ctx.fetchReply();
		this._collect(ctx, msg);
	}

	_render(cfg) {
		const c = new ContainerBuilder().setAccentColor(cfg.enabled ? colors.success : colors.error);
		const roles = (cfg.roleIds ?? []).map(id => `<@&${id}>`).join(' ') || 'None';
		const botRoles = (cfg.botRoleIds ?? []).map(id => `<@&${id}>`).join(' ') || 'None';
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
			`## 🎭 Auto-Role`,
			`**Status:** ${cfg.enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
			`**Member Roles:** ${roles}`,
			`**Bot Roles:** ${botRoles}`,
		].join('\n')));
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('ar|toggle').setLabel(cfg.enabled ? 'Disable' : 'Enable').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
			new ButtonBuilder().setCustomId('ar|setroles').setLabel('Set Member Roles').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('ar|setbotroles').setLabel('Set Bot Roles').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('ar|clear').setLabel('Clear All').setStyle(ButtonStyle.Danger),
		));
		return c;
	}

	_collect(ctx, msg) {
		const col = msg.createMessageComponentCollector({ time: 300_000, filter: i => {
			if (i.user.id !== ctx.author.id) { i.reply({ content: `${emoji.cross} Not yours.`, flags: MessageFlags.Ephemeral }); return false; }
			return true;
		}});

		autoDisable(col, msg);

		col.on('collect', async i => {
			try { await this._handle(ctx, msg, i); } catch (e) { logger.error('Autorole', e.message); }
		});
	}

	async _handle(ctx, msg, i) {
		const [, action, sub] = i.customId.split('|');
		const guildId = ctx.guild.id;

		if (action === 'toggle') {
			await i.deferUpdate();
			const cfg = db.autorole.get(guildId);
			db.autorole.setEnabled(guildId, !cfg.enabled);
			return msg.edit({ components: [this._render(db.autorole.get(guildId))] });
		}
		if (action === 'clear') {
			await i.deferUpdate();
			db.autorole.set(guildId, { roleIds: [], botRoleIds: [] });
			return msg.edit({ components: [this._render(db.autorole.get(guildId))] });
		}
		if ((action === 'setroles' || action === 'setbotroles') && !sub) {
			await i.deferUpdate();
			const c = new ContainerBuilder().setAccentColor(colors.bot);
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Select ${action === 'setroles' ? 'member' : 'bot'} roles (up to 5):`));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new RoleSelectMenuBuilder().setCustomId(`ar|${action}|select`).setMinValues(0).setMaxValues(5),
			));
			c.addActionRowComponents(new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('ar|back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
			));
			return msg.edit({ components: [c] });
		}
		if ((action === 'setroles' || action === 'setbotroles') && sub === 'select') {
			await i.deferUpdate();
			const key = action === 'setroles' ? 'roleIds' : 'botRoleIds';
			db.autorole.set(guildId, { [key]: i.values });
			return msg.edit({ components: [this._render(db.autorole.get(guildId))] });
		}
		if (action === 'back') {
			await i.deferUpdate();
			return msg.edit({ components: [this._render(db.autorole.get(guildId))] });
		}
	}
}

export default new AutoroleCommand();
