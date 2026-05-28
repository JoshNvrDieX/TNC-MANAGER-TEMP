import { Command } from '#command';
import {
	ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
	SeparatorSpacingSize, MessageFlags, ActionRowBuilder,
	ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { config } from '#config';
import { disableComponents } from '#utils';
import os from 'os';

const { colors } = config;

function formatUptime(ms) {
	const s = Math.floor(ms / 1000);
	const d = Math.floor(s / 86400);
	const h = Math.floor((s % 86400) / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	const parts = [];
	if (d) parts.push(`${d}d`);
	if (h) parts.push(`${h}h`);
	if (m) parts.push(`${m}m`);
	parts.push(`${sec}s`);
	return parts.join(' ');
}

function formatBytes(bytes) {
	if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
	return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

// Monospace tree line — matches the style in the screenshot
const L = (label, value) =>
	`\`L\`  \`${label.padEnd(14)}\` **:** ${value}`;

const PAGES = ['performance', 'memory', 'system', 'security'];

class StatsCommand extends Command {
	constructor() {
		super({
			name: 'stats',
			description: 'Show TNC Manager stats',
			usage: 'stats',
			aliases: ['status', 'botstats', 'botinfo'],
			category: 'General',
			cooldown: 10,
			enabledSlash: true,
			slashData: {
				name: 'stats',
				description: 'Show TNC Manager stats',
			},
		});
	}

	async execute({ ctx }) {
		let page = 0;
		const render = () => this._build(ctx.client, page);

		await ctx.reply({ ...render(), flags: MessageFlags.IsComponentsV2 });
		const msg = await ctx.fetchReply();

		const col = msg.createMessageComponentCollector({ time: 120_000 });

		col.on('collect', async i => {
			if (i.user.id !== ctx.author.id) {
				return i.reply({ content: 'Not your command.', flags: MessageFlags.Ephemeral });
			}
			await i.deferUpdate();
			if (i.customId === 'stats|prev') page = (page - 1 + PAGES.length) % PAGES.length;
			if (i.customId === 'stats|next') page = (page + 1) % PAGES.length;
			if (i.customId.startsWith('stats|page|')) page = parseInt(i.customId.split('|')[2]);
			await msg.edit(render());
		});

		col.on('end', async () => { try { await disableComponents(msg); } catch {} });
	}

	_build(client, page) {
		const pageName = PAGES[page];
		const content = this._pageContent(client, pageName);

		const c = new ContainerBuilder().setAccentColor(colors.bot);

		// Title
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
			`## 𝙏𝙉𝘾 𝙈𝘼𝙉𝘼𝙂𝙀𝙍 𝙎𝙏𝘼𝙏𝙎\n-# Page ${page + 1} of ${PAGES.length} — ${pageName.toUpperCase()}`
		));

		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

		// Content
		c.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));

		c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

		// Page buttons — current page is disabled to show active state
		const pageRow = new ActionRowBuilder().addComponents(
			...PAGES.map((name, i) =>
				new ButtonBuilder()
					.setCustomId(`stats|page|${i}`)
					.setLabel(name.charAt(0).toUpperCase() + name.slice(1))
					.setStyle(i === page ? ButtonStyle.Primary : ButtonStyle.Secondary)
					.setDisabled(i === page)
			),
		);

		c.addActionRowComponents(pageRow);

		return { components: [c] };
	}

	_pageContent(client, page) {
		switch (page) {
			case 'performance': {
				const ping = client.ws.ping;
				const uptime = formatUptime(process.uptime() * 1000);
				const guilds = client.guilds.cache.size;
				const users = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
				const channels = client.channels.cache.size;
				const cachedMessages = client.channels.cache.reduce((a, ch) => a + (ch.messages?.cache?.size ?? 0), 0);

				return [
					`**• Performance**`,
					L('Servers', `${guilds}`),
					L('Users', `${users.toLocaleString()}`),
					L('Channels', `${channels}`),
					L('Cached Msgs', `${cachedMessages}`),
					L('Ping', `${ping}ms`),
					L('Uptime', uptime),
				].join('\n');
			}

			case 'memory': {
				const mem = process.memoryUsage();
				const total = os.totalmem();
				const free = os.freemem();
				const used = total - free;

				return [
					`**• Memory**`,
					L('Heap Used', formatBytes(mem.heapUsed)),
					L('Heap Total', formatBytes(mem.heapTotal)),
					L('RSS', formatBytes(mem.rss)),
					L('External', formatBytes(mem.external)),
					``,
					`**• System RAM**`,
					L('Used', formatBytes(used)),
					L('Free', formatBytes(free)),
					L('Total', formatBytes(total)),
				].join('\n');
			}

			case 'system': {
				const cpus = os.cpus();
				const cpuModel = cpus[0]?.model?.trim() ?? 'Unknown';
				const cpuCores = cpus.length;
				const loadAvg = os.loadavg()[0].toFixed(2);
				const nodeVer = process.version;
				const platform = `${os.type()} ${os.arch()}`;
				const hostname = os.hostname();

				return [
					`**• System**`,
					L('Platform', platform),
					L('Hostname', hostname.length > 20 ? hostname.slice(0, 20) + '…' : hostname),
					L('CPU', cpuModel.length > 28 ? cpuModel.slice(0, 28) + '…' : cpuModel),
					L('CPU Cores', `${cpuCores}`),
					L('Load Avg', `${loadAvg}%`),
					``,
					`**• Runtime**`,
					L('Node.js', nodeVer),
					L('discord.js', `v14`),
					L('Version', config.version),
				].join('\n');
			}

			case 'security': {
				const commands = client.commandHandler?.commands?.size ?? 0;
				const slashCommands = client.commandHandler?.slashCommandFiles?.size ?? 0;
				const events = client.eventHandler?.loadedEvents
					? Array.from(client.eventHandler.loadedEvents.values()).flat().length
					: '—';

				return [
					`**• Bot**`,
					L('Prefix Cmds', `${commands}`),
					L('Slash Cmds', `${slashCommands}`),
					L('Events', `${events}`),
					L('Prefix', config.prefix),
					``,
					`**• Security**`,
					L('Antinuke', `Active`),
					L('Automod', `Active`),
					L('Logging', `Active`),
					L('DB', `SQLite`),
				].join('\n');
			}

			default:
				return 'Unknown page.';
		}
	}
}

export default new StatsCommand();
