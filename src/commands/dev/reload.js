import { Command } from '#command';
import {
	PermissionFlagsBits, MessageFlags, Routes,
	ContainerBuilder, TextDisplayBuilder,
	SeparatorBuilder, SeparatorSpacingSize,
} from 'discord.js';
import { config } from '#config';
import { logger } from '#utils';

const { colors } = config;

class ReloadCommand extends Command {
	constructor() {
		super({
			name: 'reload',
			description: 'Reload a command without restarting the bot',
			usage: 'reload <commandname | alias | "all">',
			aliases: ['rl', 'refresh'],
			category: 'developer',
			cooldown: 3,
			examples: ['reload tnc', 'reload all', 'rl ping'],
			ownerOnly: true,
			enabledSlash: true,
			slashData: {
				name: 'reload',
				description: 'Reload a command without restarting the bot',
				defaultMemberPermissions: PermissionFlagsBits.Administrator,
				options: [
					{
						name: 'target',
						description: 'Command name, alias, or "all" to reload everything',
						type: 3,
						required: true,
					},
				],
			},
		});
	}

	async execute({ ctx }) {
		const target = (ctx.isSlash ? ctx.options?.getString('target') : ctx.args?.[0])?.toLowerCase();
		if (!target) return ctx.reply('Specify a command name or `all` to reload everything.');

		if (target === 'all') {
			await ctx.reply('🔄 Reloading all commands...');
			const count = await ctx.client.commandHandler.reloadAllCommands();
			try {
				const slashData = ctx.client.commandHandler.getSlashCommandsData();
				if (slashData.length > 0) {
					await ctx.client.rest.put(
						Routes.applicationCommands(ctx.client.user.id),
						{ body: slashData },
					);
				}
			} catch {}
			return ctx.editReply(`✅ Reloaded **${count}** commands and re-synced with Discord.`);
		}

		const result = await ctx.client.commandHandler.reloadCommand(target);
		if (!result.success) {
			return ctx.reply(`❌ ${result.error}`);
		}

		const c = new ContainerBuilder().setAccentColor(colors.success);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ✅ Command Reloaded\n**\`${result.name}\`** has been reloaded successfully.`));

		try {
			const slashData = ctx.client.commandHandler.getSlashCommandsData();
			if (slashData.length > 0) {
				await ctx.client.rest.put(
					Routes.applicationCommands(ctx.client.user.id),
					{ body: slashData },
				);
				c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
				c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Slash commands re-synced with Discord.`));
			}
		} catch (e) {
			logger.warn('Reload', `Slash resync failed: ${e.message}`);
		}

		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent('- **TNC MANAGEMENT**'));

		await ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });

		logger.info('Reload', `Reloaded command: ${result.name}`);
	}
}

export default new ReloadCommand();
