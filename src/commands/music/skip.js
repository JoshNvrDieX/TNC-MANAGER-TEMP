import { Command } from '#command';
import { MessageFlags } from 'discord.js';

class SkipCommand extends Command {
	constructor() {
		super({
			name: 'skip',
			description: 'Skip the current song',
			usage: 'skip',
			aliases: ['s', 'next'],
			category: 'Music',
			cooldown: 3,
			voiceRequired: true,
			sameVoiceChannel: true,
			enabledSlash: true,
			slashData: { name: 'skip', description: 'Skip the current song' },
		});
	}

	async execute({ ctx }) {
		const player = ctx.client.music.getPlayer(ctx.guild.id);
		if (!player || !player.playing) return ctx.reply({ content: 'Nothing playing.', flags: MessageFlags.Ephemeral });
		await player.skip();
		return ctx.reply({ content: '⏭ Skipped.' });
	}
}

export default new SkipCommand();
