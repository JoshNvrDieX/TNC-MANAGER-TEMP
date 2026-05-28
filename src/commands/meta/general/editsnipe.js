import { Command } from '#command';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';

class EditSnipeCommand extends Command {
	constructor() {
		super({
			name: 'editsnipe',
			description: 'Show the last edited message in this channel',
			usage: 'editsnipe',
			aliases: ['es'],
			category: 'General',
			cooldown: 5,
			enabledSlash: false,
		});
	}

	async execute({ ctx }) {
		const logs = db.automodExt?.getLastEdited(ctx.guild.id, ctx.channel.id, 1);
		if (!logs?.length) return ctx.reply({ content: 'Nothing to editsnipe here.', flags: MessageFlags.Ephemeral });

		const log = logs[0];
		const c = new ContainerBuilder().setAccentColor(config.colors.bot);
		
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent('## ✏️ Message Edit Sniped'));
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent('Edits are captured and stored in real-time!'));
		
		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

		c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
			`- **User :** <@${log.user_id}> (\`${log.user_id}\`)`,
			`- **Original :** ${log.old_content?.slice(0, 400) || '[Unknown]'}`,
			`- **New :** ${log.content.slice(0, 400)}`,
			`- **Time :** <t:${Math.floor(new Date(log.created_at).getTime() / 1000)}:R>`
		].join('\n')));

		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent('-# **TNC MANAGEMENT** • Messages are stored temporarily.'));

		await ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
	}
}

export default new EditSnipeCommand();
