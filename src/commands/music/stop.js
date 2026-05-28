import { Command } from '#command';
import { MessageFlags } from 'discord.js';

class StopCommand extends Command {
	constructor() {
		super({
			name: 'stop',
			description: 'Stop playback and leave the voice channel',
			usage: 'stop',
			aliases: ['leave', 'disconnect'],
			category: 'Music',
			cooldown: 3,
			voiceRequired: true,
			sameVoiceChannel: true,
			enabledSlash: true,
			slashData: { name: 'stop', description: 'Stop playback and leave the voice channel' },
		});
	}

	async execute({ ctx }) {
		const player = ctx.client.music.getPlayer(ctx.guild.id);
		if (!player) return ctx.reply({ content: 'Not in a voice channel.', flags: MessageFlags.Ephemeral });
		player.destroy();
		return ctx.reply({ content: '⏹ Stopped and left.' });
	}
}

export default new StopCommand();
