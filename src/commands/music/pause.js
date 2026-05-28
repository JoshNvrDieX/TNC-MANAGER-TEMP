import { Command } from '#command';
import { MessageFlags } from 'discord.js';

class PauseCommand extends Command {
	constructor() {
		super({
			name: 'pause',
			description: 'Pause or resume playback',
			usage: 'pause',
			aliases: ['resume'],
			category: 'Music',
			cooldown: 3,
			voiceRequired: true,
			sameVoiceChannel: true,
			enabledSlash: true,
			slashData: { name: 'pause', description: 'Pause or resume playback' },
		});
	}

	async execute({ ctx }) {
		const player = ctx.client.music.getPlayer(ctx.guild.id);
		if (!player || !player.playing) return ctx.reply({ content: 'Nothing playing.', flags: MessageFlags.Ephemeral });

		if (player.paused) {
			await player.resume();
			return ctx.reply({ content: '▶ Resumed.' });
		}
		await player.pause();
		return ctx.reply({ content: '⏸ Paused.' });
	}
}

export default new PauseCommand();
