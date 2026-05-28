import { Command } from '#command';
import { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';
import { emoji } from '#emoji';

class WarningsCommand extends Command {
	constructor() {
		super({
			name: ['warnings'],
			description: 'View or manage warnings for a user',
			usage: 'warnings <@user|clear @user|remove <id>>',
			aliases: ['warns', 'warn'],
			category: 'Moderation',
			cooldown: 5,
			examples: ['warnings @user', 'warnings clear @user', 'warnings remove 3'],
			userPermissions: [PermissionFlagsBits.ModerateMembers],
			enabledSlash: false,
		});
	}

	async execute({ ctx }) {
		const [sub, ...rest] = ctx.args;

		if (sub === 'clear') {
			const target = ctx.message.mentions.users.first();
			if (!target) return ctx.reply(`${emoji.cross} Mention a user to clear warnings.`);
			db.automodExt?.clearWarnings(ctx.guild.id, target.id);
			return ctx.reply(`${emoji.check} Cleared all warnings for ${target.tag}.`);
		}

		if (sub === 'remove') {
			const id = parseInt(rest[0], 10);
			if (isNaN(id)) return ctx.reply(`${emoji.cross} Provide a valid warning ID.`);
			db.automodExt?.removeWarning(ctx.guild.id, id);
			return ctx.reply(`${emoji.check} Warning \`#${id}\` removed.`);
		}

		// View warnings
		const target = ctx.message.mentions.users.first();
		if (!target) return ctx.reply(`${emoji.cross} Mention a user to view their warnings.`);

		const warns = db.automodExt?.getWarnings(ctx.guild.id, target.id) ?? [];
		const c = new ContainerBuilder().setAccentColor(config.colors.warn);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ⚠️ Warnings — ${target.tag}`));
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

		if (!warns.length) {
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent('No warnings found.'));
		} else {
			const lines = warns.map(w => `\`#${w.id}\` — ${w.reason} — <t:${Math.floor(new Date(w.created_at).getTime() / 1000)}:R>`);
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
		}

		await ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
	}
}

export default new WarningsCommand();
