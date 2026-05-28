import { PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { Command } from '#command';
import { BackupManager } from '#classes/backupManager';
import { db } from '#dbManager';
import { emoji } from '#emoji';
import { logger } from '#utils';
import { config } from '#config';

class SyncCommand extends Command {
	constructor() {
		super({
			name: 'sync',
			description: 'Syncs the current server (Main) to a target server (Sub)',
			category: 'developer',
			ownerOnly: true,
			enabledSlash: true,
			slashData: {
				name: 'sync',
				description: 'Syncs the current server (Main) to a target server (Sub)',
				options: [
					{
						name: 'target_id',
						description: 'The ID of the target server to sync to',
						type: 3, // String
						required: true,
					},
				],
			},
		});
	}

	async execute({ ctx }) {
		const targetId = ctx.isSlash 
			? ctx.options?.getString('target_id') 
			: ctx.args?.[0];
		
		if (!targetId) {
			return ctx.reply({
				content: `${emoji.get('cross')} **Missing Target**\nPlease provide the ID of the target server to sync to.`,
				ephemeral: true
			});
		}

		const targetGuild = ctx.client.guilds.cache.get(targetId);

		if (!targetGuild) {
			return ctx.reply({
				content: `${emoji.get('cross')} **Invalid Server**\nCould not find a server with ID \`${targetId}\`. Make sure the bot is in that server.`,
				ephemeral: true
			});
		}

		if (targetId === ctx.guild.id) {
			return ctx.reply({
				content: `${emoji.get('cross')} **Error**\nYou cannot sync a server to itself.`,
				ephemeral: true
			});
		}

		// Check permissions on target guild
		if (!targetGuild.members.me.permissions.has(PermissionFlagsBits.Administrator)) {
			return ctx.reply({
				content: `${emoji.get('cross')} **Missing Permissions**\nI need **Administrator** permissions in the target server (**${targetGuild.name}**) to perform a sync.`,
				ephemeral: true
			});
		}

		// Progress UI
		const container = new ContainerBuilder().setAccentColor(config.colors.bot ?? 0x5865F2);
		
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🔄 Server Sync (Main → Sub)`));
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
		
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent([
			`### 📤 Source (Main Server)`,
			`- **Name :** \`${ctx.guild.name}\``,
			`- **ID :** \`${ctx.guild.id}\``,
			``,
			`### 📥 Destination (Sub Server)`,
			`- **Name :** \`${targetGuild.name}\``,
			`- **ID :** \`${targetGuild.id}\``,
			``,
			`### ⚠️ Warning`,
			`This will delete **EVERYTHING** (channels, roles) in **${targetGuild.name}** and replace them with a fresh clone of **${ctx.guild.name}**.`
		].join('\n')));
		
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`- **TNC MANAGEMENT**`));

		await ctx.reply({
			components: [container],
			flags: MessageFlags.IsComponentsV2
		});

		try {
			await BackupManager.syncServer(ctx.guild, targetGuild);
			
			const successContainer = new ContainerBuilder().setAccentColor(config.colors.success ?? 0x57F287);
			successContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ✅ Sync Complete`));
			successContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
			successContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent([
				`Successfully cloned channels, roles, and bot configuration to **${targetGuild.name}**.`,
				``,
				`- **Source :** \`${ctx.guild.name}\``,
				`- **Target :** \`${targetGuild.name}\``,
				``,
				`-# Note: Member-specific roles and messages are not synced.`
			].join('\n')));
			successContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
			successContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`- **TNC MANAGEMENT**`));

			await ctx.editReply({
				components: [successContainer],
				flags: MessageFlags.IsComponentsV2
			});
			
			logger.success('Sync', `Manual sync performed by ${ctx.user.tag}: ${ctx.guild.name} -> ${targetGuild.name}`);
		} catch (e) {
			logger.error('Sync', `Manual sync failed`, e);
			await ctx.editReply({
				content: `${emoji.get('cross')} **Sync Failed**\nAn error occurred during the synchronization: \`${e.message}\``,
				components: []
			});
		}
	}
}

export default new SyncCommand();
