import { Command } from '#command';
import { MessageFlags, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { config } from '#config';

const { colors } = config;

class NpCommand extends Command {
	constructor() {
		super({
			name: 'np',
			description: 'Show what\'s currently playing',
			usage: 'np',
			aliases: ['nowplaying', 'current', 'playing'],
			category: 'Music',
			cooldown: 3,
			enabledSlash: true,
			slashData: { name: 'np', description: 'Show what\'s currently playing' },
		});
	}

	async execute({ ctx }) {
		const player = ctx.client.music.getPlayer(ctx.guild.id);
		if (!player || !player.queue.current) return ctx.reply({ content: 'Nothing playing.', flags: MessageFlags.Ephemeral });

		const t = player.queue.current;
		const progress = player.position || 0;
		const total = t.length || 0;
		const barLen = 20;
		const filled = total > 0 ? Math.round((progress / total) * barLen) : 0;
		const bar = '▬'.repeat(filled) + '🔘' + '▬'.repeat(Math.max(0, barLen - filled - 1));

		const c = new ContainerBuilder().setAccentColor(colors.bot);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
			`## 🎵 Now Playing\n**${t.title}**\n${t.author}\n\n\`${bar}\` **${_fmt(progress)} / ${_fmt(total)}**`,
		));
		return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
	}
}

function _fmt(ms) {
	if (!ms) return '0:00';
	const s = Math.floor(ms / 1000);
	const m = Math.floor(s / 60);
	const h = Math.floor(m / 60);
	if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
	return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default new NpCommand();
