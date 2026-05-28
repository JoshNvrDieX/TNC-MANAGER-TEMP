import { Command } from '#command';
import { MessageFlags, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { config } from '#config';

const { colors } = config;

class VolumeCommand extends Command {
	constructor() {
		super({
			name: 'volume',
			description: 'Set the playback volume (0-1000)',
			usage: 'volume <0-1000>',
			aliases: ['vol', 'v'],
			category: 'Music',
			cooldown: 3,
			voiceRequired: true,
			sameVoiceChannel: true,
			enabledSlash: true,
			slashData: {
				name: 'volume',
				description: 'Set the playback volume',
				options: [
					{ name: 'level', description: 'Volume level (0-1000)', type: 4, required: true, minValue: 0, maxValue: 1000 },
				],
			},
		});
	}

	async execute({ ctx }) {
		const player = ctx.client.music.getPlayer(ctx.guild.id);
		if (!player) return ctx.reply({ content: 'Nothing playing.', flags: MessageFlags.Ephemeral });

		let vol;
		if (ctx.isSlash) {
			vol = ctx.options?.getInteger('level');
		} else {
			vol = parseInt(ctx.args[0]);
		}

		if (isNaN(vol) || vol < 0 || vol > 1000) {
			return ctx.reply({ content: 'Volume must be 0-1000.', flags: MessageFlags.Ephemeral });
		}

		player.setVolume(vol);
		const barLen = 20;
		const filled = Math.round((vol / 1000) * barLen);
		const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
		const c = new ContainerBuilder().setAccentColor(colors.bot);
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🔊 Volume\n\`${bar}\` **${vol}%**`));
		return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
	}
}

export default new VolumeCommand();
