import { Command } from '#command';
import {
	PermissionFlagsBits, MessageFlags, ButtonStyle,
	ActionRowBuilder, ButtonBuilder, ContainerBuilder,
	TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
	ModalBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';
import { InteractionRouter } from '#classes/interactionRouter';
import { logger } from '#utils';

const { colors } = config;

class TncCommand extends Command {
	constructor() {
		super({
			name: 'tnc',
			description: 'TNC Esports management — apply and manage members',
			usage: 'tnc [panel|info|setrole]',
			aliases: ['esports'],
			category: 'Esports',
			cooldown: 5,
			examples: ['tnc', 'tnc info @user', 'tnc setrole @role'],
			userPermissions: [PermissionFlagsBits.Administrator],
			enabledSlash: true,
			slashData: {
				name: 'tnc',
				description: 'TNC Esports management',
				defaultMemberPermissions: PermissionFlagsBits.Administrator,
				options: [
					{
						name: 'panel',
						description: 'Send the TNC Esports application panel',
						type: 1,
					},
					{
						name: 'info',
						description: 'View a registered member\'s details',
						type: 1,
						options: [
							{ name: 'user', description: 'The member to look up', type: 6, required: true },
						],
					},
					{
						name: 'setrole',
						description: 'Set the required role for applying',
						type: 1,
						options: [
							{ name: 'role', description: 'The role members must have to apply (omit to clear)', type: 8, required: false },
						],
					},
				],
			},
		});

		InteractionRouter.register('tnc', async (i) => {
			await this._handleInteraction(i);
		});
	}

	async execute({ ctx }) {
		if (!ctx.guild) return ctx.reply('This command is only available in servers.');

		const sub = ctx.isSlash ? ctx.options?.getSubcommand() : ctx.args?.[0];

		if (sub === 'info') {
			let target;
			if (ctx.isSlash) {
				target = ctx.options?.getUser('user');
			} else {
				target = ctx.message?.mentions.users.first();
				if (!target) {
					const id = ctx.args?.[1];
					if (id) {
						target = await ctx.client.users.fetch(id).catch(() => null);
					}
				}
			}
			if (!target) return ctx.reply('Please mention a user or provide a user ID.');
			return this._showInfo(ctx, target);
		}

		if (sub === 'setrole') {
			let role;
			if (ctx.isSlash) {
				role = ctx.options?.getRole('role');
			} else {
				role = ctx.message?.mentions.roles.first();
			}
			db.tnc.setSettings(ctx.guild.id, { requiredRoleId: role ? role.id : null });
			const msg = role
				? `✅ Required role set to <@&${role.id}>`
				: '✅ Required role cleared. Anyone can now apply.';
			return ctx.reply(msg);
		}

		return ctx.reply({ components: [this._renderPanel(ctx.guild)], flags: MessageFlags.IsComponentsV2 });
	}

	_renderPanel(guild) {
		const settings = db.tnc.getSettings(guild.id) || {};
		const requiredRole = settings.requiredRoleId || config.tnc?.requiredRoleId;
		const c = new ContainerBuilder().setAccentColor(colors.bot);

		c.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 🔥 TNC ESPORTS — APPLY NOW'));
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
			'> Join the elite Free Fire squad. Fill out the form below to register.',
			'',
			'### 📋 Requirements',
			`- **Game Name** must start with \`TNC \``,
			requiredRole ? `- You need the <@&${requiredRole}> role` : '',
			'- Be active and committed',
		].filter(Boolean).join('\n')));

		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

		c.addActionRowComponents(new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('tnc|apply').setLabel('📝 Apply Now').setStyle(ButtonStyle.Primary),
		));

		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent('- **TNC MANAGEMENT**'));

		return c;
	}

	async _showInfo(ctx, target) {
		if (!target) return ctx.reply({ content: 'Please mention a user or provide a user ID.' });

		const member = ctx.guild.members.cache.get(target.id);
		const data = db.tnc.get(target.id);

		if (!data) {
			return ctx.reply({ content: `❌ **${target.username}** is not registered in TNC Esports.` });
		}

		const c = new ContainerBuilder().setAccentColor(colors.success);

		c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
			`## 🎮 TNC Member — ${target.username}`,
			`> ${member ? member.toString() : `<@${target.id}>`} · \`${target.id}\``,
		].join('\n')));

		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

		c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
			`### 👤 Personal Info`,
			`**Real Name:** ${data.realName}`,
			`**Game Name:** ${data.gameName}`,
			`**Phone:** ${data.phoneNumber}`,
			`**Active Hours:** ${data.activeHours}`,
			`**Role:** ${data.playingRole}`,
			`**Registered:** ${data.registeredAt}`,
		].join('\n')));

		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent('- **TNC MANAGEMENT**'));

		return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
	}

	_applyModal() {
		const modal = new ModalBuilder()
			.setCustomId('tnc|apply_modal')
			.setTitle('TNC Esports Application');

		const realName = new TextInputBuilder()
			.setCustomId('realName')
			.setLabel('Enter your real name')
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('John Doe')
			.setRequired(true)
			.setMaxLength(100);

		const gameName = new TextInputBuilder()
			.setCustomId('gameName')
			.setLabel('Game name (must start with TNC)')
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('TNC YourName')
			.setRequired(true)
			.setMaxLength(100);

		const phoneNumber = new TextInputBuilder()
			.setCustomId('phoneNumber')
			.setLabel('Enter your phone number')
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('+91 1234567890')
			.setRequired(true)
			.setMaxLength(20);

		const activeHours = new TextInputBuilder()
			.setCustomId('activeHours')
			.setLabel('Your active playing hours')
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('8 PM - 11 PM IST')
			.setRequired(true)
			.setMaxLength(100);

		const playingRole = new TextInputBuilder()
			.setCustomId('playingRole')
			.setLabel('Your playing role in Free Fire')
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('Rusher / Support / Sniper')
			.setRequired(true)
			.setMaxLength(100);

		modal.addComponents(
			new ActionRowBuilder().addComponents(realName),
			new ActionRowBuilder().addComponents(gameName),
			new ActionRowBuilder().addComponents(phoneNumber),
			new ActionRowBuilder().addComponents(activeHours),
			new ActionRowBuilder().addComponents(playingRole),
		);

		return modal;
	}

	async _handleInteraction(i) {
		const guild = i.guild;
		if (!guild) return;

		if (i.isModalSubmit() && i.customId === 'tnc|apply_modal') {
			return this._handleApplyModal(i);
		}

		if (i.isButton() && i.customId === 'tnc|apply') {
			return this._handleApplyButton(i);
		}
	}

	async _handleApplyButton(i) {
		const member = i.member;
		const guild = i.guild;

		const settings = db.tnc.getSettings(guild.id) || {};
		const requiredRole = settings.requiredRoleId || config.tnc?.requiredRoleId;

		if (requiredRole) {
			if (!member.roles.cache.has(requiredRole)) {
				return i.reply({
					content: `❌ You need the <@&${requiredRole}> role to apply.`,
					flags: MessageFlags.Ephemeral,
				});
			}
		}

		const existing = db.tnc.get(i.user.id);
		if (existing) {
			return i.reply({
				content: '❌ You are already registered in TNC Esports!',
				flags: MessageFlags.Ephemeral,
			});
		}

		await i.showModal(this._applyModal());
	}

	async _handleApplyModal(i) {
		const guild = i.guild;
		const fields = i.fields;
		const realName = fields.getTextInputValue('realName').trim();
		const gameName = fields.getTextInputValue('gameName').trim();
		const phoneNumber = fields.getTextInputValue('phoneNumber').trim();
		const activeHours = fields.getTextInputValue('activeHours').trim();
		const playingRole = fields.getTextInputValue('playingRole').trim();

		if (!gameName.startsWith('TNC ')) {
			return i.reply({
				content: '❌ Your game name must start with **TNC** (e.g. `TNC YourName`). Please try again.',
				flags: MessageFlags.Ephemeral,
			});
		}

		const existing = db.tnc.get(i.user.id);
		if (existing) {
			return i.reply({
				content: '❌ You are already registered in TNC Esports!',
				flags: MessageFlags.Ephemeral,
			});
		}

		try {
			db.tnc.register(i.user.id, guild.id, { realName, gameName, phoneNumber, activeHours, playingRole });

			await i.reply({
				content: '✅ Your application has been submitted! Check your DMs.',
				flags: MessageFlags.Ephemeral,
			});

			try {
				await i.user.send({
					content: '## ✅ TNC Esports Registration Successful!\n\nYour details has been registered for TNC Esports! Glad you here <3\n\nStay tuned for squad updates and events.',
				});
			} catch {
				logger.warn('TNC', `Could not DM ${i.user.tag} after registration`);
			}

			logger.info('TNC', `${i.user.tag} registered in ${guild.name}`);
		} catch (error) {
			logger.error('TNC', `Registration failed for ${i.user.tag}: ${error.message}`);
			return i.reply({
				content: '❌ Something went wrong while saving your application. Please try again later.',
				flags: MessageFlags.Ephemeral,
			});
		}
	}
}

export default new TncCommand();
