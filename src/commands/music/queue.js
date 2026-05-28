import { Command } from '#command';
import { MessageFlags, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { config } from '#config';

const { colors } = config;

class QueueCommand extends Command {
	constructor() {
		super({
			name: 'queue',
			description: 'Show the current song queue',
			usage: 'queue',
			aliases: ['q'],
			category: 'Music',
			cooldown: 5,
			enabledSlash: true,
			slashData: { name: 'queue', description: 'Show the current song queue' },
		});
	}

	async execute({ ctx }) {
		const player = ctx.client.music.getPlayer(ctx.guild.id);
		if (!player || (!player.playing && player.queue.size === 0)) {
			return ctx.reply({ content: 'Queue is empty.', flags: MessageFlags.Ephemeral });
		}

		const lines = [];
		const current = player.queue.current;
		if (current) {
			lines.push(`**Now Playing:** ${current.title} — ${current.author}`);
			lines.push('');
		}

		const tracks = player.queue.tracks;
		if (tracks.length === 0) {
			lines.push('No more songs in queue.');
		} else {
			lines.push(`**Up Next** (${tracks.length} songs):`);
			const show = tracks.slice(0, 15);
			show.forEach((t, i) => lines.push(`${i + 1}. ${t.title} — ${t.author}`));
			if (tracks.length > 15) lines.push(`*...and ${tracks.length - 15} more*`);
		}

		const c = new ContainerBuilder().setAccentColor(colors.bot);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📋 Queue\n${lines.join('\n')}`));
		return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
	}
}

export default new QueueCommand();
