import { Command } from "#command";
import {
  MessageFlags,
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { emoji } from "#emoji";
import { config } from "#config";
import { db } from "#dbManager";
import { autoDisable, logger } from "#utils";

const { colors } = config;

class EditProfileCommand extends Command {
  constructor() {
    super({
      name: "profileedit",
      description: "Edit your profile card settings",
      usage: "profileedit",
      aliases: ["editprofile", "ep"],
      examples: ["profileedit"],
      cooldown: 10,
      enabledSlash: true,
      slashData: {
        name: "profileedit",
        description: "Edit your profile card settings",
      },
    });
  }

  async execute({ ctx }) {
    const profileData = await db.userProfiles.getProfile(ctx.author.id);

    const container = this._createEditPanelView(profileData);

    await ctx.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });

    const message = await ctx.fetchReply();

    const collector = message.createMessageComponentCollector({
      time: 300_000,
      filter: (i) => {
        if (i.user.id !== ctx.author.id) {
          i.reply({
            content: `${emoji.cross} Not your command, run your own.`,
            flags: MessageFlags.Ephemeral,
          });
          return false;
        }
        return true;
      },
    });

    autoDisable(collector, message);

    collector.on("collect", async (interaction) => {
      try {
        switch (interaction.customId) {
          case "edit_tagline":
            await this._handleEditTagline(interaction, message);
            break;
          case "edit_description":
            await this._handleEditDescription(interaction, message);
            break;
          case "edit_loc_age_prof":
            await this._handleEditLocAgeProf(interaction, message);
            break;
          case "edit_banner":
            await this._handleEditBanner(interaction, message);
            break;
          case "edit_font":
            await this._handleEditFont(interaction, message);
            break;
          case "remove_banner":
            await this._handleRemoveBanner(interaction, message);
            break;
          case "clear_profile":
            await this._handleClearProfile(interaction, message);
            break;
          case "done":
            await this._handleDone(interaction, message);
            break;
        }
      } catch (error) {
        logger.error(
          "ProfileEdit",
          `Button error (${interaction.customId}):`,
          error,
        );
        if (!interaction.replied && !interaction.deferred) {
          const container = new ContainerBuilder();
          container.setAccentColor(colors.error);
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "## Error\n\nAn error occurred while processing your request.",
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

  _createEditPanelView(data) {
    const container = new ContainerBuilder();
    container.setAccentColor(colors.bot);

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Edit Profile"),
    );

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true),
    );

    const tagline = data.tagline ? `\`${data.tagline}\`` : "*Not set*";
    const description = data.description
      ? `*${data.description}*`
      : "*Not set*";
    const location = data.location ? `\`${data.location}\`` : "*Not set*";
    const age = data.age ? `\`${data.age}\`` : "*Not set*";
    const profession = data.profession ? `\`${data.profession}\`` : "*Not set*";
    const banner = data.bannerUrl
      ? `\`${data.bannerUrl}\``
      : "*Not set — avatar used as fallback*";

    const fontLabel = `\`${data.fontId || "zillaslab"}\``;

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Tagline** — ${tagline}\n` +
          `**Description** — ${description}\n\n` +
          `**Location** — ${location}\n` +
          `**Age** — ${age}\n` +
          `**Profession** — ${profession}\n` +
          `**Banner** — ${banner}\n` +
          `**Font** — ${fontLabel}\n\n` +
          "-# Tagline is required to display your profile card.",
      ),
    );

    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true),
    );

    const row1 = new ActionRowBuilder();
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId("edit_tagline")
        .setLabel("Tagline")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("edit_description")
        .setLabel("Description")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("edit_loc_age_prof")
        .setLabel("Location / Age / Profession")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("edit_banner")
        .setLabel("Banner")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("edit_font")
        .setLabel("Font")
        .setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder();
    row2.addComponents(
      new ButtonBuilder()
        .setCustomId("remove_banner")
        .setLabel("Remove Banner")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!data.bannerUrl),
      new ButtonBuilder()
        .setCustomId("clear_profile")
        .setLabel("Clear Profile")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("done")
        .setLabel("Done")
        .setStyle(ButtonStyle.Success),
    );

    container.addActionRowComponents(row1, row2);

    return container;
  }

  async _refreshPanel(originalMessage, userId) {
    const profileData = await db.userProfiles.getProfile(userId);
    const container = this._createEditPanelView(profileData);
    await originalMessage.edit({ components: [container] });
  }

  async _showModal(interaction, customId, title, fields) {
    const modal = new ModalBuilder().setCustomId(customId).setTitle(title);

    for (const f of fields) {
      const input = new TextInputBuilder()
        .setCustomId(f.id)
        .setStyle(f.style || TextInputStyle.Short)
        .setLabel(f.label)
        .setRequired(f.required !== false)
        .setMinLength(f.minLength || 1)
        .setMaxLength(f.maxLength || 200);

      if (f.placeholder) input.setPlaceholder(f.placeholder);
      if (f.value) input.setValue(f.value);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
    }

    await interaction.showModal(modal);

    const filter = (i) =>
      i.customId === customId && i.user.id === interaction.user.id;
    const submitted = await interaction
      .awaitModalSubmit({ filter, time: 300_000 })
      .catch(() => null);

    return submitted;
  }

  async _handleEditTagline(interaction, originalMessage) {
    const profile = await db.userProfiles.getProfile(interaction.user.id);

    const submitted = await this._showModal(
      interaction,
      "modal_tagline",
      "Edit Tagline",
      [
        {
          id: "tagline",
          label: "Tagline",
          placeholder: "e.g. </> | Head Mod - AeroX",
          maxLength: 100,
          value: profile.tagline || "",
        },
      ],
    );

    if (!submitted) return;
    await submitted.deferReply({ flags: MessageFlags.Ephemeral });

    const tagline = submitted.fields.getTextInputValue("tagline").trim();
    await db.userProfiles.setTagline(interaction.user.id, tagline || null);

    await this._refreshPanel(originalMessage, interaction.user.id);

    const c = new ContainerBuilder();
    c.setAccentColor(colors.success);
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Tagline Updated\n\nYour tagline has been saved.",
      ),
    );
    await submitted.editReply({
      components: [c],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  async _handleEditDescription(interaction, originalMessage) {
    const profile = await db.userProfiles.getProfile(interaction.user.id);

    const submitted = await this._showModal(
      interaction,
      "modal_description",
      "Edit Description",
      [
        {
          id: "description",
          label: "Description",
          style: TextInputStyle.Paragraph,
          placeholder: "Tell us about yourself...",
          maxLength: 500,
          value: profile.description || "",
        },
      ],
    );

    if (!submitted) return;
    await submitted.deferReply({ flags: MessageFlags.Ephemeral });

    const description = submitted.fields
      .getTextInputValue("description")
      .trim();
    await db.userProfiles.setDescription(
      interaction.user.id,
      description || null,
    );

    await this._refreshPanel(originalMessage, interaction.user.id);

    const c = new ContainerBuilder();
    c.setAccentColor(colors.success);
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Description Updated\n\nYour description has been saved.",
      ),
    );
    await submitted.editReply({
      components: [c],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  async _handleEditLocAgeProf(interaction, originalMessage) {
    const profile = await db.userProfiles.getProfile(interaction.user.id);

    const submitted = await this._showModal(
      interaction,
      "modal_loc_age_prof",
      "Location / Age / Profession",
      [
        {
          id: "location",
          label: "Location",
          placeholder: "e.g. India/Tamilnadu/Chennai",
          maxLength: 100,
          value: profile.location || "",
          required: false,
        },
        {
          id: "age",
          label: "Age",
          placeholder: "e.g. 17",
          maxLength: 5,
          value: profile.age || "",
          required: false,
        },
        {
          id: "profession",
          label: "Profession",
          placeholder: "e.g. Developer",
          maxLength: 100,
          value: profile.profession || "",
          required: false,
        },
      ],
    );

    if (!submitted) return;
    await submitted.deferReply({ flags: MessageFlags.Ephemeral });

    const location = submitted.fields.getTextInputValue("location").trim();
    const age = submitted.fields.getTextInputValue("age").trim();
    const profession = submitted.fields.getTextInputValue("profession").trim();

    await db.userProfiles.updateProfile(interaction.user.id, {
      location: location || null,
      age: age || null,
      profession: profession || null,
    });

    await this._refreshPanel(originalMessage, interaction.user.id);

    const c = new ContainerBuilder();
    c.setAccentColor(colors.success);
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Profile Info Updated\n\nYour location, age, and profession have been saved.",
      ),
    );
    await submitted.editReply({
      components: [c],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  async _handleEditBanner(interaction, originalMessage) {
    const submitted = await this._showModal(
      interaction,
      "modal_banner",
      "Set Banner URL",
      [
        {
          id: "banner_url",
          label: "Banner Image URL",
          placeholder: "https://example.com/banner.png",
          maxLength: 500,
          required: false,
          description: "Direct link to an image (PNG, JPG, GIF)",
        },
      ],
    );

    if (!submitted) return;
    await submitted.deferReply({ flags: MessageFlags.Ephemeral });

    const url = submitted.fields.getTextInputValue("banner_url").trim();
    await db.userProfiles.setBannerUrl(interaction.user.id, url || null);

    await this._refreshPanel(originalMessage, interaction.user.id);

    const c = new ContainerBuilder();
    c.setAccentColor(colors.success);
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        url
          ? "## Banner Set\n\nYour banner URL has been saved."
          : "## Banner Removed\n\nBanner URL has been cleared.",
      ),
    );
    await submitted.editReply({
      components: [c],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  async _handleEditFont(interaction, originalMessage) {
    const profile = await db.userProfiles.getProfile(interaction.user.id);

    const submitted = await this._showModal(
      interaction,
      "modal_font",
      "Choose Font",
      [
        {
          id: "font_id",
          label: "Font name",
          placeholder: "bangers, zillaslab, ribes, pixelifysans, ...",
          maxLength: 30,
          value: profile.fontId || "zillaslab",
        },
      ],
    );

    if (!submitted) return;
    await submitted.deferReply({ flags: MessageFlags.Ephemeral });

    const fontId = submitted.fields
      .getTextInputValue("font_id")
      .trim()
      .toLowerCase();
    await db.userProfiles.updateProfile(interaction.user.id, {
      fontId: fontId || "zillaslab",
    });

    await this._refreshPanel(originalMessage, interaction.user.id);

    const c = new ContainerBuilder();
    c.setAccentColor(colors.success);
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## Font Updated\n\nYour profile will now use \`${fontId || "zillaslab"}\`.`,
      ),
    );
    await submitted.editReply({
      components: [c],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  async _handleRemoveBanner(interaction, originalMessage) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    await db.userProfiles.setBannerUrl(interaction.user.id, null);
    await this._refreshPanel(originalMessage, interaction.user.id);

    const c = new ContainerBuilder();
    c.setAccentColor(colors.success);
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Banner Removed\n\nYour banner has been cleared.",
      ),
    );
    await interaction.editReply({
      components: [c],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  async _handleClearProfile(interaction, originalMessage) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    await db.userProfiles.clearProfile(interaction.user.id);
    await this._refreshPanel(originalMessage, interaction.user.id);

    const c = new ContainerBuilder();
    c.setAccentColor(colors.success);
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Profile Cleared\n\nAll profile data has been reset.",
      ),
    );
    await interaction.editReply({
      components: [c],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  async _handleDone(interaction, originalMessage) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const profile = await db.userProfiles.getProfile(interaction.user.id);
    const taglineSet = !!profile.tagline;

    if (!taglineSet) {
      const c = new ContainerBuilder();
      c.setAccentColor(colors.warn);
      c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Tagline Required\n\nPlease set a tagline before finishing. Tagline is required to display your profile card.",
        ),
      );
      return interaction.editReply({
        components: [c],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    await originalMessage.delete().catch(() => {});

    const c = new ContainerBuilder();
    c.setAccentColor(colors.success);
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Done\n\nYour profile has been saved! Use `profile` to view your profile card.",
      ),
    );
    await interaction.editReply({
      components: [c],
      flags: MessageFlags.IsComponentsV2,
    });
  }
}

export default new EditProfileCommand();
