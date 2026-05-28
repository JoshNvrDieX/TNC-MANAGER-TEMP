import { Command } from '#command';
import {
	PermissionFlagsBits,
	MessageFlags,
	ButtonStyle,
	ActionRowBuilder,
	ButtonBuilder,
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	LabelBuilder,
} from 'discord.js';
import { REST } from '@discordjs/rest';
import { db } from '#dbManager';
import { config } from '#config';
import { emoji } from '#emoji';
const { colors } = config;
import { autoDisable, disableComponents } from '#utils';

const FONT_NAMES = {
	1: 'Bangers', 2: 'BioRhyme', 3: 'Cherry Bomb (Sakura)',
	4: 'Chicle (Jellybean)', 5: 'Compagnon', 6: 'MuseoModerno (Modern)',
	7: 'Neo-Castel (Medieval)', 8: 'Pixelify Sans (8Bit)',
	9: 'Ribes', 10: 'Sinistre (Vampyre)', 11: 'Default (GG Sans)',
	12: 'Zilla Slab (Tempo)',
};
const EFFECT_NAMES = {
	1: 'Solid', 2: 'Gradient', 3: 'Neon', 4: 'Toon', 5: 'Pop', 6: 'Glow',
};
const FONT_OPTIONS = [
	{ id: 11, name: 'Default (GG Sans)', emoji: '🔄' },
	{ id: 1, name: 'Bangers', emoji: '💥' },
	{ id: 2, name: 'BioRhyme', emoji: '✒️' },
	{ id: 3, name: 'Cherry Bomb (Sakura)', emoji: '🌸' },
	{ id: 4, name: 'Chicle (Jellybean)', emoji: '🫘' },
	{ id: 5, name: 'Compagnon', emoji: '🎨' },
	{ id: 6, name: 'MuseoModerno (Modern)', emoji: '📐' },
	{ id: 7, name: 'Neo-Castel (Medieval)', emoji: '🏰' },
	{ id: 8, name: 'Pixelify Sans (8Bit)', emoji: '🕹️' },
	{ id: 9, name: 'Ribes', emoji: '🎭' },
	{ id: 10, name: 'Sinistre (Vampyre)', emoji: '🧛' },
	{ id: 12, name: 'Zilla Slab (Tempo)', emoji: '⏱️' },
];
const EFFECT_OPTIONS = [
	{ id: 1, name: 'Solid', desc: 'Flat single color' },
	{ id: 2, name: 'Gradient', desc: 'Left-to-right color blend' },
	{ id: 3, name: 'Neon', desc: 'Glowing light effect' },
	{ id: 4, name: 'Toon', desc: 'Vertical gradient with outline' },
	{ id: 5, name: 'Pop', desc: 'Text with shadow offset' },
	{ id: 6, name: 'Glow', desc: 'Text with soft outer glow' },
];

class NameChangeCommand extends Command {
	constructor() {
		super({
			name: 'namechange',
			description: "Change the bot's display name style instantly",
			usage: 'namechange',
			userPermissions: [PermissionFlagsBits.Administrator],
			enabledSlash: true,
			slashData: {
				name: 'namechange',
				description: "Change the bot's display name style instantly",
				defaultMemberPermissions: PermissionFlagsBits.Administrator,
			},
		});
	}

	async execute({ ctx }) {
		if (!ctx.guild) {
			const container = new ContainerBuilder();
			container.setAccentColor(colors.error);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					'## Server Only\n\nThis command can only be used in a server.',
				),
			);
			return ctx.reply({
				components: [container],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
		}

		if (ctx.guild.ownerId !== ctx.author.id) {
			const container = new ContainerBuilder();
			container.setAccentColor(colors.error);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					'## Server Owner Only\n\nOnly the server owner can use this command.',
				),
			);
			return ctx.reply({
				components: [container],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
		}

		const saved = await db.guild.getNameStyleData(ctx.guild.id);
		const state = {
			fontId: saved.fontId || null,
			effectId: saved.effectId || null,
			colors: saved.colors || [],
		};

		const panel = this._buildPanel(state);
		await ctx.reply({
			components: [panel],
			flags: MessageFlags.IsComponentsV2,
		});

		const message = await ctx.fetchReply();
		this._startCollector(ctx, message, state);
	}

	_buildPanel(state) {
		const fontLabel = state.fontId
			? `${FONT_NAMES[state.fontId] || state.fontId}`
			: '*Not set*';
		const effectLabel = state.effectId
			? `${EFFECT_NAMES[state.effectId] || state.effectId}`
			: '*Not set*';
		const colorLabel =
			state.colors.length > 0
				? state.colors.map((c) => `#${c.toString(16).toUpperCase().padStart(6, '0')}`).join(', ')
				: '*Not set*';

		const container = new ContainerBuilder();
		container.setAccentColor(colors.bot);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				'## ⚡ Name Style\n\n' +
					`**Font:** ${fontLabel}\n` +
					`**Effect:** ${effectLabel}\n` +
					`**Colors:** ${colorLabel}\n\n` +
					'-# No cooldown — change as many times as you want!',
			),
		);

		container.addSeparatorComponents(
			new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
		);

		const row1 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId('nc_font')
				.setLabel('Font')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('nc_effect')
				.setLabel('Effect')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('nc_colors')
				.setLabel('Colors')
				.setStyle(ButtonStyle.Secondary),
		);

		const row2 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId('nc_apply')
				.setLabel('Apply')
				.setStyle(ButtonStyle.Success)
				.setDisabled(!(state.fontId && state.effectId && state.colors.length > 0)),
		);

		container.addActionRowComponents(row1, row2);
		return container;
	}

	_startCollector(ctx, message, state) {
		const collector = message.createMessageComponentCollector({
			time: 300_000,
			filter: (i) => {
				if (i.user.id !== ctx.author.id) {
					i.reply({
						content: `${emoji.cross} Not your command dude, Use ur own command `,
						flags: MessageFlags.Ephemeral,
					});
					return false;
				}
				return true;
			},
		});

		autoDisable(collector, message);

		collector.on('collect', async (interaction) => {
			try {
				switch (interaction.customId) {
					case 'nc_font':
						await this._showFontSelect(interaction, message, state);
						break;
					case 'nc_font_sel':
						await this._handleFontSelect(interaction, message, state);
						break;
					case 'nc_effect':
						await this._showEffectSelect(interaction, message, state);
						break;
					case 'nc_effect_sel':
						await this._handleEffectSelect(interaction, message, state);
						break;
					case 'nc_colors':
						await this._handleColors(interaction, message, state);
						break;
					case 'nc_apply':
						await this._handleApply(interaction, ctx.guild.id, message, state);
						break;
					case 'nc_back':
						await this._backToPanel(interaction, message, state);
						break;
				}
			} catch (error) {
				if (!interaction.replied && !interaction.deferred) {
					const container = new ContainerBuilder();
					container.setAccentColor(colors.error);
					container.addTextDisplayComponents(
						new TextDisplayBuilder().setContent(
							'## Error\n\nAn error occurred while processing your request.',
						),
					);
					await interaction.reply({
						components: [container],
						flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
					});
				}
			}
		});
	}

	async _showFontSelect(interaction, message, state) {
		await interaction.deferUpdate();

		const select = new StringSelectMenuBuilder()
			.setCustomId('nc_font_sel')
			.setPlaceholder('Pick a font…')
			.addOptions(
				FONT_OPTIONS.map((f) =>
					new StringSelectMenuOptionBuilder()
						.setLabel(f.name)
						.setValue(String(f.id))
						.setEmoji({ name: f.emoji })
						.setDefault(state.fontId === f.id),
				),
			);

		const backButton = new ButtonBuilder()
			.setCustomId('nc_back')
			.setLabel('Back')
			.setStyle(ButtonStyle.Secondary);

		const container = new ContainerBuilder();
		container.setAccentColor(colors.bot);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent('## Select Font\n\nChoose a font style for the bot display name.'),
		);
		container.addActionRowComponents(
			new ActionRowBuilder().addComponents(select),
			new ActionRowBuilder().addComponents(backButton),
		);

		await message.edit({ components: [container] });
	}

	async _handleFontSelect(interaction, message, state) {
		await interaction.deferUpdate();
		state.fontId = parseInt(interaction.values[0]);
		const panel = this._buildPanel(state);
		await message.edit({ components: [panel] });
	}

	async _showEffectSelect(interaction, message, state) {
		await interaction.deferUpdate();

		const select = new StringSelectMenuBuilder()
			.setCustomId('nc_effect_sel')
			.setPlaceholder('Pick an effect…')
			.addOptions(
				EFFECT_OPTIONS.map((e) =>
					new StringSelectMenuOptionBuilder()
						.setLabel(e.name)
						.setDescription(e.desc)
						.setValue(String(e.id))
						.setDefault(state.effectId === e.id),
				),
			);

		const backButton = new ButtonBuilder()
			.setCustomId('nc_back')
			.setLabel('Back')
			.setStyle(ButtonStyle.Secondary);

		const container = new ContainerBuilder();
		container.setAccentColor(colors.bot);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent('## Select Effect\n\nChoose a visual effect for the bot display name.'),
		);
		container.addActionRowComponents(
			new ActionRowBuilder().addComponents(select),
			new ActionRowBuilder().addComponents(backButton),
		);

		await message.edit({ components: [container] });
	}

	async _handleEffectSelect(interaction, message, state) {
		await interaction.deferUpdate();
		state.effectId = parseInt(interaction.values[0]);
		const panel = this._buildPanel(state);
		await message.edit({ components: [panel] });
	}

	async _handleColors(interaction, message, state) {
		const modal = new ModalBuilder()
			.setCustomId('modal_nc_colors')
			.setTitle('Set Colors');

		const c1 = new TextInputBuilder()
			.setCustomId('nc_c1')
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('Hex code, e.g. FF0000 or #FF0000')
			.setRequired(true)
			.setMinLength(6)
			.setMaxLength(7);

		const c2 = new TextInputBuilder()
			.setCustomId('nc_c2')
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('Only used by Gradient/Toon/Pop/Glow')
			.setRequired(false)
			.setMaxLength(7);

		modal.addLabelComponents(
			new LabelBuilder()
				.setLabel('Color 1')
				.setDescription('Primary text colour (hex, required)')
				.setTextInputComponent(c1),
			new LabelBuilder()
				.setLabel('Color 2')
				.setDescription('Secondary colour (hex, optional)')
				.setTextInputComponent(c2),
		);

		await interaction.showModal(modal);

		const filter = (s) =>
			s.customId === 'modal_nc_colors' && s.user.id === interaction.user.id;

		const submitted = await interaction
			.awaitModalSubmit({ filter, time: 300_000 })
			.catch(() => null);

		if (!submitted) return;
		await submitted.deferReply({ flags: MessageFlags.Ephemeral });

		const parseHex = (raw) => {
			const hex = raw.trim().replace('#', '');
			if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return NaN;
			return parseInt(hex, 16);
		};

		const c1Raw = submitted.fields.getTextInputValue('nc_c1');
		const c2Raw = submitted.fields.getTextInputValue('nc_c2');
		const v1 = parseHex(c1Raw);

		if (isNaN(v1)) {
			const container = new ContainerBuilder();
			container.setAccentColor(colors.error);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					'## Invalid Color\n\nEnter a valid 6-digit hex code (e.g. FF0000 or #FF0000).',
				),
			);
			return submitted.editReply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
		}

		state.colors = [v1];

		if (c2Raw && c2Raw.trim()) {
			const v2 = parseHex(c2Raw);
			if (isNaN(v2)) {
				const container = new ContainerBuilder();
				container.setAccentColor(colors.error);
				container.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						'## Invalid Color 2\n\nEnter a valid 6-digit hex code or leave it empty.',
					),
				);
				return submitted.editReply({
					components: [container],
					flags: MessageFlags.IsComponentsV2,
				});
			}
			state.colors.push(v2);
		}

		const panel = this._buildPanel(state);
		await message.edit({ components: [panel] });

		const container = new ContainerBuilder();
		container.setAccentColor(colors.success);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				'## Colors Set\n\n' +
					state.colors.map((c) => `#${c.toString(16).toUpperCase().padStart(6, '0')}`).join(', '),
			),
		);
		await submitted.editReply({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		});
	}

	async _handleApply(interaction, guildId, message, state) {
		if (!state.fontId || !state.effectId || state.colors.length === 0) {
			const container = new ContainerBuilder();
			container.setAccentColor(colors.error);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					'## Incomplete Settings\n\nPlease configure font, effect, and colors before applying.',
				),
			);
			return interaction.reply({
				components: [container],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const rest = new REST({ version: '10' }).setToken(interaction.client.token);
			await rest.patch(`/guilds/${interaction.guildId}/members/@me`, {
				body: {
					display_name_font_id: state.fontId,
					display_name_effect_id: state.effectId,
					display_name_colors: state.colors,
				},
			});

			await db.guild.setCustomProfileStatus(guildId, true);
			await db.guild.setNameStyleData(guildId, {
				fontId: state.fontId,
				effectId: state.effectId,
				colors: state.colors,
			});

			const container = new ContainerBuilder();
			container.setAccentColor(colors.success);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					'## ⚡ Name Style Applied!\n\n' +
						`**Font:** ${FONT_NAMES[state.fontId] || state.fontId}\n` +
						`**Effect:** ${EFFECT_NAMES[state.effectId] || state.effectId}\n` +
						`**Colors:** ${state.colors.map((c) => `#${c.toString(16).toUpperCase().padStart(6, '0')}`).join(', ')}`,
				),
			);
			await interaction.editReply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});

			const panel = this._buildPanel(state);
			await message.edit({ components: [panel] });
		} catch (error) {
			const container = new ContainerBuilder();
			container.setAccentColor(colors.error);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					'## Failed to Update Name Style\n\nPlease try again.',
				),
			);
			await interaction.editReply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
		}
	}

	async _backToPanel(interaction, message, state) {
		await interaction.deferUpdate();
		const panel = this._buildPanel(state);
		await message.edit({ components: [panel] });
	}
}

export default new NameChangeCommand();
