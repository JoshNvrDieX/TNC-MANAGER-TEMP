import { MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { config } from '#config';
import { db } from '#dbManager';
import { logger } from '#utils';

export default {
	name: 'autoModerationActionExecution',
	async execute({ eventArgs, client }) {
		const [execution] = eventArgs;
		const { guild, userId, ruleId, ruleName, channelId, content, matchedContent } = execution;
		
		if (!guild) return;

		// We only want to log rules managed by our bot (prefixed with [TNC])
		// to avoid duplicating logs for other bots or manual rules.
		if (!ruleName || !ruleName.startsWith('[TNC]')) return;

		const user = await client.users.fetch(userId).catch(() => null);
		if (!user) return;

		const logChannelId = db.logging.get(guild.id)?.automodChannel || db.automod.get(guild.id)?.logChannel;
		if (!logChannelId) return;

		const logCh = guild.channels.cache.get(logChannelId);
		if (!logCh?.isTextBased()) return;

		// Determine reason based on rule name
		let reason = ruleName.replace('[TNC] ', '');
		if (reason === 'Keyword') reason = 'Word Filter';

		const logContainer = new ContainerBuilder().setAccentColor(config.colors.error ?? 0xFF0000);
		
		logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🛡️ ${reason} (Native)`));
		logContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
		
		logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent([
			`- **User :** <@${userId}> (\`${userId}\`)`,
			`- **Action :** \`BLOCK MESSAGE\``,
			`- **Channel :** <#${channelId}>`,
			`- **Timestamp :** <t:${Math.floor(Date.now() / 1000)}:F>`,
			`- **Matched :** \`${matchedContent || 'N/A'}\``
		].join('\n')));

		if (content) {
			logContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
			logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Message Preview:**\n\`\`\`${content.slice(0, 1000)}\`\`\``));
		}

		logContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
		logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`- **TNC MANAGEMENT**`));

		logCh.send({ 
			components: [logContainer],
			flags: MessageFlags.IsComponentsV2 
		}).catch(() => {});

		logger.info('NativeAutomod', `Enforced native rule "${ruleName}" for ${user.tag} in ${guild.id}`);
	},
};
