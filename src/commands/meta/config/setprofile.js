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
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	FileUploadBuilder,
	LabelBuilder,
	SectionBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from 'discord.js';
import { REST } from '@discordjs/rest';
import { db } from '#dbManager';
import { config } from '#config';
import { emoji } from '#emoji';
const { colors } = config;
import { autoDisable, disableComponents } from '#utils';

class SetProfileCommand extends Command {
	constructor() {
		super({
			name: 'setprofile',
			description: "Customize bot's server profile",
			usage: 'setprofile',
			aliases: ['botprofile'],
			cooldown: 600,
			userPermissions: [PermissionFlagsBits.Administrator],
			enabledSlash: true,
			slashData: {
				name: 'setprofile',
				description: "Customize bot's server profile",
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
		const container = await this._buildHome(ctx.guild.id, ctx.client);
		await ctx.reply({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		});

		const message = await ctx.fetchReply();
		const nameStyle = { fontId: null, effectId: null, colors: [] };

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
				if (interaction.customId === 'profile_avatar') {
					await this._handleAvatar(interaction, ctx.guild.id, message);
				} else if (interaction.customId === 'profile_banner') {
					await this._handleBanner(interaction, ctx.guild.id, message);
				} else if (interaction.customId === 'profile_bio') {
					await this._handleBio(interaction, ctx.guild.id, message);
				} else if (interaction.customId === 'reset_profile') {
					await this._handleReset(interaction, ctx.guild.id, message);
				} else if (interaction.customId === 'profile_namestyle') {
					await this._handleNameStyle(interaction, ctx.guild.id, message, nameStyle);
				} else if (interaction.customId === 'ns_font') {
					await this._showFontSelect(interaction, message, nameStyle);
				} else if (interaction.customId === 'ns_font_sel') {
					await this._handleFontSelect(interaction, message, nameStyle);
				} else if (interaction.customId === 'ns_effect') {
					await this._showEffectSelect(interaction, message, nameStyle);
				} else if (interaction.customId === 'ns_effect_sel') {
					await this._handleEffectSelect(interaction, message, nameStyle);
				} else if (interaction.customId === 'ns_colors') {
					await this._handleNameStyleColors(interaction, message, nameStyle);
				} else if (interaction.customId === 'ns_apply') {
					await this._handleNameStyleApply(interaction, ctx.guild.id, message, nameStyle);
				} else if (interaction.customId === 'ns_back') {
					await this._backToHome(interaction, ctx.guild.id, message);
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

	_checkCooldown(lastUpdate) {
		if (!lastUpdate) return null;
		const timeSince = Date.now() - new Date(lastUpdate).getTime();
		const hoursLeft = Math.ceil((10800000 - timeSince) / 3600000);
		if (timeSince < 10800000) {
			return `This can only be updated once every 3 hours. Try again in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}.`;
		}
		return null;
	}

	async _buildHome(guildId, client) {
		const isCustomProfile = await db.guild.getCustomProfileStatus(guildId);
		const bioText = await db.guild.getProfileBioText(guildId);
		const nameStyle = await db.guild.getNameStyleData(guildId);

		let avatarStatus = 'Default';
		let bannerStatus = 'Default';
		let bioStatus = bioText ? `"${bioText.length > 50 ? bioText.slice(0, 50) + '…' : bioText}"` : '*Not set*';
		let nsStatus = '*Not set*';

		if (isCustomProfile && client) {
			try {
				const rest = new REST({ version: '10' }).setToken(client.token);
				const member = await rest.get(`/guilds/${guildId}/members/@me`);
				if (member.avatar) avatarStatus = '✓ Custom';
				if (member.banner) bannerStatus = '✓ Custom';
			} catch {} // eslint-disable-line no-empty
		}

		if (nameStyle.fontId) {
			const fontNames = {
				1: 'Bangers', 2: 'BioRhyme', 3: 'Cherry Bomb',
				4: 'Chicle', 5: 'Compagnon', 6: 'MuseoModerno',
				7: 'Neo-Castel', 8: 'Pixelify Sans', 9: 'Ribes',
				10: 'Sinistre', 11: 'Default', 12: 'Zilla Slab',
			};
			const effectNames = { 1: 'Solid', 2: 'Gradient', 3: 'Neon', 4: 'Toon', 5: 'Pop', 6: 'Glow' };
			const f = fontNames[nameStyle.fontId] || nameStyle.fontId;
			const e = effectNames[nameStyle.effectId] || nameStyle.effectId;
			const c = nameStyle.colors?.length
				? nameStyle.colors.map((v) => `#${v.toString(16).toUpperCase().padStart(6, '0')}`).join(', ')
				: '';
			nsStatus = `Font ${f}, ${e}${c ? `, ${c}` : ''}`;
		}

		const container = new ContainerBuilder();
		container.setAccentColor(colors.bot);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				'## Bot Profile Customization\n\n' +
					`**Avatar:** ${avatarStatus}\n` +
					`**Banner:** ${bannerStatus}\n` +
					`**Bio:** ${bioStatus}\n` +
					`**Name Style:** ${nsStatus}`,
			),
		);

		container.addSeparatorComponents(
			new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
		);

		container.addSectionComponents(
			new SectionBuilder()
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						'Pick a setting below to customize:\n\n' +
							'-# Each can be updated once every 3 hours',
					),
				)
				.setButtonAccessory(
					new ButtonBuilder()
						.setCustomId('reset_profile')
						.setLabel('Reset All')
						.setStyle(ButtonStyle.Danger)
						.setDisabled(!isCustomProfile),
				),
		);

		container.addSeparatorComponents(
			new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
		);

		const buttons = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId('profile_avatar')
				.setLabel('Avatar')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('profile_banner')
				.setLabel('Banner')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('profile_bio')
				.setLabel('Bio')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('profile_namestyle')
				.setLabel('Name Style')
				.setStyle(ButtonStyle.Secondary),
		);

		container.addActionRowComponents(buttons);
		return container;
	}

	async _handleReset(interaction, guildId, originalMessage) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const rest = new REST({ version: '10' }).setToken(interaction.client.token);
		await rest.patch(`/guilds/${interaction.guildId}/members/@me`, {
			body: { avatar: null, banner: null, bio: null },
		});
		await db.guild.setCustomProfileStatus(guildId, false);
		await db.guild.setProfileBioText(guildId, null);
		await db.guild.setNameStyleData(guildId, {});

		const updatedContainer = await this._buildHome(guildId, interaction.client);
		await originalMessage.edit({
			components: [updatedContainer],
		});

		const container = new ContainerBuilder();
		container.setAccentColor(colors.success);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				'## Profile Reset\n\nBot profile has been reset to default',
			),
		);

		await interaction.editReply({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		});
	}

	async _handleAvatar(interaction, guildId, originalMessage) {
		const lastUpdate = await db.guild.getAvatarUpdatedAt(guildId);
		const cooldownMsg = this._checkCooldown(lastUpdate);

		if (cooldownMsg) {
			const container = new ContainerBuilder();
			container.setAccentColor(colors.error);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(`## Cooldown Active\n\n${cooldownMsg}`),
			);
			return interaction.reply({
				components: [container],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
		}

		const modal = new ModalBuilder()
			.setCustomId('modal_avatar')
			.setTitle('Set Bot Avatar');

		const fileUpload = new FileUploadBuilder()
			.setCustomId('avatar_file')
			.setRequired(true)
			.setMinValues(1)
			.setMaxValues(1);

		const label = new LabelBuilder()
			.setLabel('Upload Avatar Image')
			.setDescription('PNG, JPG, GIF or WEBP format')
			.setFileUploadComponent(fileUpload);

		modal.addLabelComponents(label);

		await interaction.showModal(modal);

		const filter = (i) =>
			i.customId === 'modal_avatar' && i.user.id === interaction.user.id;

		const submitted = await interaction
			.awaitModalSubmit({ filter, time: 300_000 })
			.catch(() => null);

		if (!submitted) return;

		await submitted.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const files = submitted.fields.getUploadedFiles('avatar_file');

			if (files.size === 0) {
				const container = new ContainerBuilder();
				container.setAccentColor(colors.error);
				container.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						'## No File Uploaded\n\nPlease upload an image file.',
					),
				);
				return submitted.editReply({
					components: [container],
					flags: MessageFlags.IsComponentsV2,
				});
			}

			const file = files.first();

			if (!file.contentType?.startsWith('image/')) {
				const container = new ContainerBuilder();
				container.setAccentColor(colors.error);
				container.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						'## Invalid File Type\n\nPlease upload an image file.',
					),
				);
				return submitted.editReply({
					components: [container],
					flags: MessageFlags.IsComponentsV2,
				});
			}

			const response = await fetch(file.url);
			if (!response.ok) {
				const container = new ContainerBuilder();
				container.setAccentColor(colors.error);
				container.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						'## Failed to Fetch Image\n\nPlease try again.',
					),
				);
				return submitted.editReply({
					components: [container],
					flags: MessageFlags.IsComponentsV2,
				});
			}

			const buffer = Buffer.from(await response.arrayBuffer());
			const base64Data = `data:${file.contentType};base64,${buffer.toString('base64')}`;

			const rest = new REST({ version: '10' }).setToken(interaction.client.token);
			await rest.patch(`/guilds/${interaction.guildId}/members/@me`, {
				body: { avatar: base64Data },
			});

			await db.guild.setAvatarUpdatedAt(guildId);
			await db.guild.setCustomProfileStatus(guildId, true);

			const updatedContainer = await this._buildHome(guildId, interaction.client);
			await originalMessage.edit({
				components: [updatedContainer],
			});

			const container = new ContainerBuilder();
			container.setAccentColor(colors.success);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					'## Avatar Updated\n\nSuccessfully updated bot avatar for this server!',
				),
			);

			await submitted.editReply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
		} catch (error) {
			const container = new ContainerBuilder();
			container.setAccentColor(colors.error);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					'## Failed to Update Avatar\n\nPlease try again.',
				),
			);
			await submitted.editReply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
		}
	}

	async _handleBanner(interaction, guildId, originalMessage) {
		const lastUpdate = await db.guild.getBannerUpdatedAt(guildId);
		const cooldownMsg = this._checkCooldown(lastUpdate);

		if (cooldownMsg) {
			const container = new ContainerBuilder();
			container.setAccentColor(colors.error);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(`## Cooldown Active\n\n${cooldownMsg}`),
			);
			return interaction.reply({
				components: [container],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
		}

		const modal = new ModalBuilder()
			.setCustomId('modal_banner')
			.setTitle('Set Bot Banner');

		const fileUpload = new FileUploadBuilder()
			.setCustomId('banner_file')
			.setRequired(true)
			.setMinValues(1)
			.setMaxValues(1);

		const label = new LabelBuilder()
			.setLabel('Upload Banner Image')
			.setDescription('PNG, JPG, GIF or WEBP format')
			.setFileUploadComponent(fileUpload);

		modal.addLabelComponents(label);

		await interaction.showModal(modal);

		const filter = (i) =>
			i.customId === 'modal_banner' && i.user.id === interaction.user.id;

		const submitted = await interaction
			.awaitModalSubmit({ filter, time: 300_000 })
			.catch(() => null);

		if (!submitted) return;

		await submitted.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const files = submitted.fields.getUploadedFiles('banner_file');

			if (files.size === 0) {
				const container = new ContainerBuilder();
				container.setAccentColor(colors.error);
				container.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						'## No File Uploaded\n\nPlease upload an image file.',
					),
				);
				return submitted.editReply({
					components: [container],
					flags: MessageFlags.IsComponentsV2,
				});
			}

			const file = files.first();

			if (!file.contentType?.startsWith('image/')) {
				const container = new ContainerBuilder();
				container.setAccentColor(colors.error);
				container.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						'## Invalid File Type\n\nPlease upload an image file.',
					),
				);
				return submitted.editReply({
					components: [container],
					flags: MessageFlags.IsComponentsV2,
				});
			}

			const response = await fetch(file.url);
			if (!response.ok) {
				const container = new ContainerBuilder();
				container.setAccentColor(colors.error);
				container.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						'## Failed to Fetch Image\n\nPlease try again.',
					),
				);
				return submitted.editReply({
					components: [container],
					flags: MessageFlags.IsComponentsV2,
				});
			}

			const buffer = Buffer.from(await response.arrayBuffer());
			const base64Data = `data:${file.contentType};base64,${buffer.toString('base64')}`;

			const rest = new REST({ version: '10' }).setToken(interaction.client.token);
			await rest.patch(`/guilds/${interaction.guildId}/members/@me`, {
				body: { banner: base64Data },
			});

			await db.guild.setBannerUpdatedAt(guildId);
			await db.guild.setCustomProfileStatus(guildId, true);

			const updatedContainer = await this._buildHome(guildId, interaction.client);
			await originalMessage.edit({
				components: [updatedContainer],
			});

			const container = new ContainerBuilder();
			container.setAccentColor(colors.success);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					'## Banner Updated\n\nSuccessfully updated bot banner for this server!',
				),
			);

			await submitted.editReply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
		} catch (error) {
			const container = new ContainerBuilder();
			container.setAccentColor(colors.error);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					'## Failed to Update Banner\n\nPlease try again.',
				),
			);
			await submitted.editReply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
		}
	}

	async _handleBio(interaction, guildId, originalMessage) {
		const lastUpdate = await db.guild.getBioUpdatedAt(guildId);
		const cooldownMsg = this._checkCooldown(lastUpdate);

		if (cooldownMsg) {
			const container = new ContainerBuilder();
			container.setAccentColor(colors.error);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(`## Cooldown Active\n\n${cooldownMsg}`),
			);
			return interaction.reply({
				components: [container],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
		}

		const modal = new ModalBuilder().setCustomId('modal_bio').setTitle('Set Bot Bio');

		const bioInput = new TextInputBuilder()
			.setCustomId('bio_text')
			.setStyle(TextInputStyle.Paragraph)
			.setPlaceholder('Enter bot bio (max 190 characters)')
			.setRequired(true)
			.setMinLength(2)
			.setMaxLength(190);

		const label = new LabelBuilder()
			.setLabel('Bio Text')
			.setDescription('Custom about me section')
			.setTextInputComponent(bioInput);

		modal.addLabelComponents(label);

		await interaction.showModal(modal);

		const filter = (i) => i.customId === 'modal_bio' && i.user.id === interaction.user.id;

		const submitted = await interaction
			.awaitModalSubmit({ filter, time: 300_000 })
			.catch(() => null);

		if (!submitted) return;

		await submitted.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const bioText = submitted.fields.getTextInputValue('bio_text');

			const rest = new REST({ version: '10' }).setToken(interaction.client.token);
			await rest.patch(`/guilds/${interaction.guildId}/members/@me`, {
				body: { bio: bioText },
			});

			await db.guild.setBioUpdatedAt(guildId);
			await db.guild.setCustomProfileStatus(guildId, true);
			await db.guild.setProfileBioText(guildId, bioText);

			const updatedContainer = await this._buildHome(guildId, interaction.client);
			await originalMessage.edit({
				components: [updatedContainer],
			});

			const container = new ContainerBuilder();
			container.setAccentColor(colors.success);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`## Bio Updated\n\nSuccessfully updated bot bio for this server!\n\n-# ${bioText}`,
				),
			);

			await submitted.editReply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
		} catch (error) {
			const container = new ContainerBuilder();
			container.setAccentColor(colors.error);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					'## Failed to Update Bio\n\nPlease try again.',
				),
			);
			await submitted.editReply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
		}
	}

	_buildNameStylePanel(state) {
		const fontNames = {
			1: 'Bangers', 2: 'BioRhyme', 3: 'Cherry Bomb (Sakura)',
			4: 'Chicle (Jellybean)', 5: 'Compagnon', 6: 'MuseoModerno (Modern)',
			7: 'Neo-Castel (Medieval)', 8: 'Pixelify Sans (8Bit)',
			9: 'Ribes', 10: 'Sinistre (Vampyre)', 11: 'Default (GG Sans)',
			12: 'Zilla Slab (Tempo)',
		};
		const effectNames = {
			1: 'Solid', 2: 'Gradient', 3: 'Neon', 4: 'Toon', 5: 'Pop', 6: 'Glow',
		};

		const fontLabel = state.fontId
			? `${fontNames[state.fontId] || state.fontId}`
			: '*Not set*';
		const effectLabel = state.effectId
			? `${effectNames[state.effectId] || state.effectId}`
			: '*Not set*';
		const colorLabel =
			state.colors.length > 0
				? state.colors.map((c) => `#${c.toString(16).toUpperCase().padStart(6, '0')}`).join(', ')
				: '*Not set*';

		const container = new ContainerBuilder();
		container.setAccentColor(colors.bot);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				'## Name Style\n\n' +
					`**Font:** ${fontLabel}\n` +
					`**Effect:** ${effectLabel}\n` +
					`**Colors:** ${colorLabel}\n\n` +
					'-# Use the buttons below to change each setting, then click **Apply**.',
			),
		);

		container.addSeparatorComponents(
			new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
		);

		const row1 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId('ns_font')
				.setLabel('Font')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('ns_effect')
				.setLabel('Effect')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('ns_colors')
				.setLabel('Colors')
				.setStyle(ButtonStyle.Secondary),
		);

		const row2 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId('ns_apply')
				.setLabel('Apply')
				.setStyle(ButtonStyle.Success)
				.setDisabled(!(state.fontId && state.effectId && state.colors.length > 0)),
			new ButtonBuilder()
				.setCustomId('ns_back')
				.setLabel('Back')
				.setStyle(ButtonStyle.Secondary),
		);

		container.addActionRowComponents(row1, row2);
		return container;
	}

	async _handleNameStyle(interaction, guildId, originalMessage, state) {
		const lastUpdate = await db.guild.getDisplayNameUpdatedAt(guildId);
		const cooldownMsg = this._checkCooldown(lastUpdate);

		if (cooldownMsg) {
			const container = new ContainerBuilder();
			container.setAccentColor(colors.error);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`## Cooldown Active\n\n${cooldownMsg}`,
				),
			);
			return interaction.reply({
				components: [container],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
		}

		const saved = await db.guild.getNameStyleData(guildId);
		state.fontId = saved.fontId || null;
		state.effectId = saved.effectId || null;
		state.colors = saved.colors || [];

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const panel = this._buildNameStylePanel(state);
		await originalMessage.edit({ components: [panel] });

		const container = new ContainerBuilder();
		container.setAccentColor(colors.bot);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				'## Name Style\n\nConfigure font, effect, and colors using the panel above, then click **Apply**.',
			),
		);
		await interaction.editReply({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		});
	}

	async _showFontSelect(interaction, message, state) {
		await interaction.deferUpdate();

		const fontOptions = [
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

		const select = new StringSelectMenuBuilder()
			.setCustomId('ns_font_sel')
			.setPlaceholder('Pick a font…')
			.addOptions(
				fontOptions.map((f) =>
					new StringSelectMenuOptionBuilder()
						.setLabel(f.name)
						.setValue(String(f.id))
						.setEmoji({ name: f.emoji })
						.setDefault(state.fontId === f.id),
				),
			);

		const backButton = new ButtonBuilder()
			.setCustomId('ns_back')
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
		const panel = this._buildNameStylePanel(state);
		await message.edit({ components: [panel] });
	}

	async _showEffectSelect(interaction, message, state) {
		await interaction.deferUpdate();

		const effectOptions = [
			{ id: 1, name: 'Solid', desc: 'Flat single color' },
			{ id: 2, name: 'Gradient', desc: 'Left-to-right color blend' },
			{ id: 3, name: 'Neon', desc: 'Glowing light effect' },
			{ id: 4, name: 'Toon', desc: 'Vertical gradient with outline' },
			{ id: 5, name: 'Pop', desc: 'Text with shadow offset' },
			{ id: 6, name: 'Glow', desc: 'Text with soft outer glow' },
		];

		const select = new StringSelectMenuBuilder()
			.setCustomId('ns_effect_sel')
			.setPlaceholder('Pick an effect…')
			.addOptions(
				effectOptions.map((e) =>
					new StringSelectMenuOptionBuilder()
						.setLabel(e.name)
						.setDescription(e.desc)
						.setValue(String(e.id))
						.setDefault(state.effectId === e.id),
				),
			);

		const backButton = new ButtonBuilder()
			.setCustomId('ns_back')
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
		const panel = this._buildNameStylePanel(state);
		await message.edit({ components: [panel] });
	}

	async _handleNameStyleColors(interaction, message, state) {
		const modal = new ModalBuilder()
			.setCustomId('modal_ns_colors')
			.setTitle('Set Colors');

		const color1Input = new TextInputBuilder()
			.setCustomId('ns_c1')
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('Hex code, e.g. FF0000 or #FF0000')
			.setRequired(true)
			.setMinLength(6)
			.setMaxLength(7);

		const color2Input = new TextInputBuilder()
			.setCustomId('ns_c2')
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('Only used by Gradient/Toon/Pop/Glow')
			.setRequired(false)
			.setMaxLength(7);

		const label1 = new LabelBuilder()
			.setLabel('Color 1')
			.setDescription('Primary text colour (hex, required)')
			.setTextInputComponent(color1Input);

		const label2 = new LabelBuilder()
			.setLabel('Color 2')
			.setDescription('Secondary colour (hex, optional)')
			.setTextInputComponent(color2Input);

		modal.addLabelComponents(label1, label2);
		await interaction.showModal(modal);

		const filter = (i) =>
			i.customId === 'modal_ns_colors' && i.user.id === interaction.user.id;

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

		const c1Raw = submitted.fields.getTextInputValue('ns_c1');
		const c2Raw = submitted.fields.getTextInputValue('ns_c2');

		const c1 = parseHex(c1Raw);
		if (isNaN(c1)) {
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

		state.colors = [c1];

		if (c2Raw && c2Raw.trim()) {
			const c2 = parseHex(c2Raw);
			if (isNaN(c2)) {
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
			state.colors.push(c2);
		}

		const panel = this._buildNameStylePanel(state);
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

	async _handleNameStyleApply(interaction, guildId, originalMessage, state) {
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

			await db.guild.setDisplayNameUpdatedAt(guildId);
			await db.guild.setCustomProfileStatus(guildId, true);
			await db.guild.setNameStyleData(guildId, {
				fontId: state.fontId,
				effectId: state.effectId,
				colors: state.colors,
			});

			const updatedContainer = await this._buildHome(guildId, interaction.client);
			await originalMessage.edit({ components: [updatedContainer] });

			const container = new ContainerBuilder();
			container.setAccentColor(colors.success);
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					'## Name Style Updated\n\n' +
						`**Font:** ${state.fontId}\n` +
						`**Effect:** ${state.effectId}\n` +
						`**Colors:** ${state.colors.map((c) => `#${c.toString(16).toUpperCase().padStart(6, '0')}`).join(', ')}`,
				),
			);
			await interaction.editReply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
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

	async _backToHome(interaction, guildId, originalMessage) {
		await interaction.deferUpdate();

		const container = await this._buildHome(guildId, interaction.client);
		await originalMessage.edit({ components: [container] });
	}
}

export default new SetProfileCommand();
