import { Command } from "#command";
import { MessageFlags, AttachmentBuilder } from "discord.js";
import { db } from "#dbManager";
import { generateProfileCard } from "#profileCard";

class ProfileCommand extends Command {
  constructor() {
    super({
      name: "profile",
      description: "View your profile card",
      usage: "profile [@user]",
      aliases: ["pf", "pro"],
      examples: ["profile", "profile @user"],
      cooldown: 5,
      enabledSlash: true,
      slashData: {
        name: "profile",
        description: "View a user profile card",
        options: [
          {
            name: "user",
            description: "The user to view",
            type: 6,
            required: false,
          },
        ],
      },
    });
  }

  async execute({ ctx }) {
    let targetId = ctx.author.id;

    if (ctx.isSlash) {
      const user = ctx.options.getUser("user");
      if (user) targetId = user.id;
    } else if (ctx.args.length > 0) {
      const mention = ctx.args[0].replace(/[<@!>]/g, "");
      if (mention) targetId = mention;
    }

    const target = await ctx.client.users.fetch(targetId).catch(() => null);
    if (!target) {
      return ctx.reply({ content: "User not found." });
    }

    const profile = await db.userProfiles.getProfile(targetId);

    if (!profile.tagline) {
      const isSelf = targetId === ctx.author.id;
      return ctx.reply({
        content: isSelf
          ? "You haven't set up your profile yet. Use `profileedit` to get started."
          : `${target.username} hasn't set up their profile yet.`,
      });
    }

    try {
      const avatarUrl = target.displayAvatarURL({
        extension: "png",
        size: 256,
        forceStatic: true,
      });

      const nitroBannerUrl =
        target.bannerURL({ extension: "png", size: 1024 }) || null;
      const decorationURL = target.avatarDecorationURL() || null;

      const buffer = await generateProfileCard({
        username: target.displayName,
        avatarUrl,
        tagline: profile.tagline || "",
        description: profile.description || null,
        location: profile.location || "Not set",
        age: profile.age || "Not set",
        profession: profile.profession || "Not set",
        bannerUrl: profile.bannerUrl || null,
        nitroBannerUrl,
        decorationURL,
        fontId: profile.fontId || "zillaslab",
      });

      const attachment = new AttachmentBuilder(buffer, { name: "profile.png" });
      await ctx.reply({ files: [attachment] });
    } catch (error) {
      await ctx.reply({
        content: "Failed to generate profile card. Please try again later.",
      });
    }
  }
}

export default new ProfileCommand();
