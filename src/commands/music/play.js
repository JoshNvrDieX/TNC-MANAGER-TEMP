import { Command } from '#command';
import { MessageFlags, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { config } from '#config';

const { colors } = config;

class PlayCommand extends Command {
	constructor() {
		super({
			name: 'play',
			description: 'Play a song from any supported source',
			usage: 'play <song name or URL>',
			aliases: ['p'],
			category: 'Music',
			cooldown: 3,
			voiceRequired: true,
			sameVoiceChannel: true,
			enabledSlash: true,
			slashData: {
				name: 'play',
				description: 'Play a song from any supported source',
				options: [
					{ name: 'query', description: 'Song name or URL', type: 3, required: true },
				],
			},
		});
	}

	async execute({ ctx }) {
		const query = ctx.isSlash ? ctx.options?.getString('query') : ctx.args.join(' ');
		if (!query) return ctx.reply({ content: 'Provide a song name or URL.', flags: MessageFlags.Ephemeral });

		const vc = ctx.member?.voice?.channel;
		if (!vc) return ctx.reply({ content: 'Join a voice channel first.', flags: MessageFlags.Ephemeral });

		if (!ctx.client.music.ready) return ctx.reply({ content: 'No Lavalink nodes available.', flags: MessageFlags.Ephemeral });

		if (ctx.isSlash) await ctx.deferReply();

		try {
			const result = await ctx.client.music.search(query, ctx.author);

			if (result.isError) {
				return ctx.reply({ content: `Search error: ${result.exception?.message || 'unknown'}` });
			}

			if (result.isEmpty || !result.tracks?.length) {
				return ctx.reply({ content: `No results for "${query}".` });
			}

			const player = ctx.client.music.manager.players.get(ctx.guild.id)
				?? ctx.client.music.manager.players.create({
					guildId: ctx.guild.id,
					voiceChannelId: vc.id,
					textChannelId: ctx.channel.id,
					volume: 100,
				});

			if (result.isPlaylist) {
				const playlistName = result.playlistInfo?.name || 'Unknown Playlist';
				for (const track of result.tracks) {
					player.queue.add(track);
				}
				if (!player.playing && result.tracks.length > 0) {
					await player.play(result.tracks[0]);
				}
				const c = new ContainerBuilder().setAccentColor(colors.bot);
				c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
					`## 📀 Playlist Added\n**${playlistName}** — ${result.tracks.length} tracks queued.`,
				));
				return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
			}

			const track = result.tracks[0];
			if (!player.playing) {
				await player.play(track);
			} else {
				player.queue.add(track);
			}

			const current = player.queue.current;
			const status = current?.uid === track.uid ? 'Now Playing' : 'Added to Queue';
			const c = new ContainerBuilder().setAccentColor(colors.bot);
			c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
				`## 🎵 ${status}\n**${track.title}**\n${track.author} · ${_fmt(track.length)}`,
			));
			return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
		} catch (err) {
			return ctx.reply({ content: `Error: ${err.message}` });
		}
	}
}

function _fmt(ms) {
	const s = Math.floor(ms / 1000);
	const m = Math.floor(s / 60);
	const h = Math.floor(m / 60);
	if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
	return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default new PlayCommand();
