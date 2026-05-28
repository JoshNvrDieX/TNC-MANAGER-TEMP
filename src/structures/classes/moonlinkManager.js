import { Manager } from 'moonlink.js';
import { config } from '#config';
import { logger } from '#utils';

export class MoonlinkManager {
	constructor(client) {
		this.client = client;
		this.manager = null;
	}

	init() {
		const cfg = config.lavalink;
		if (!cfg?.nodes?.length) {
			logger.warn('Moonlink', 'No Lavalink nodes configured');
			return;
		}

		this.manager = new Manager({
			nodes: cfg.nodes.map((n) => ({
				identifier: n.identifier,
				host: n.host,
				port: n.port,
				password: n.password,
				secure: n.secure ?? false,
			})),
			options: {
				guilds: [...this.client.guilds.cache.keys()],
				defaultPlayer: {
					volume: 100,
					autoPlay: false,
					autoLeave: true,
					selfDeaf: true,
					selfMute: false,
					loop: 'off',
				},
				search: {
					defaultPlatform: 'ytsearch',
					resultLimit: 10,
				},
				playerDestruction: {
					autoDestroyOnIdle: true,
					idleTimeout: 120000,
				},
			},
			send: (guildId, payload) => {
				const guild = this.client.guilds.cache.get(guildId);
				if (guild) guild.shard.send(payload);
			},
		});

		this.manager.on('nodeConnect', (node) => {
			logger.success('Moonlink', `Node connected: ${node.identifier}`);
		});

		this.manager.on('nodeDisconnect', (node, reason) => {
			logger.warn('Moonlink', `Node disconnected: ${node.identifier} — ${reason || 'unknown'}`);
		});

		this.manager.on('nodeError', (node, error) => {
			logger.error('Moonlink', `Node error: ${node.identifier} — ${error.message}`);
		});

		this.manager.on('playerCreate', (player) => {
			logger.info('Moonlink', `Player created for guild ${player.guildId}`);
		});

		this.manager.on('playerDestroy', (player) => {
			logger.info('Moonlink', `Player destroyed for guild ${player.guildId}`);
		});

		this.manager.on('playerDisconnect', (player) => {
			logger.info('Moonlink', `Player disconnected for guild ${player.guildId}`);
		});

		this.manager.on('trackStart', (player, track) => {
			logger.info('Moonlink', `Playing: ${track.title} in ${player.guildId}`);
		});

		this.manager.on('trackEnd', (player, track) => {
			logger.info('Moonlink', `Finished: ${track.title} in ${player.guildId}`);
		});

		this.client.on('raw', (d) => this.manager.packetUpdate(d));

		this.manager.init(this.client.user.id);
		logger.info('Moonlink', 'Moonlink initialized');
	}

	get players() {
		return this.manager?.players ?? { cache: new Map() };
	}

	get ready() {
		return this.manager?.hasReadyNodes ?? false;
	}

	getPlayer(guildId) {
		return this.manager?.players.get(guildId) ?? null;
	}

	async search(query, requester) {
		if (!this.manager) throw new Error('Moonlink not initialized');
		const result = await this.manager.search({ query, requester });
		if (result.isError) logger.error('Moonlink', `Search error: ${result.exception?.message || 'unknown'}`);
		return result;
	}
}

export default MoonlinkManager;
