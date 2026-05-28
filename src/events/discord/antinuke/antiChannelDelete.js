import { AuditLogEvent } from 'discord.js';
import { AntinukeEngine } from '#classes/antinukeEngine';
import { db } from '#dbManager';
import { logger } from '#utils';

export default {
	name: 'channelDelete',
	async execute({ eventArgs, client }) {
		const [channel] = eventArgs;
		const guild = channel.guild;
		if (!guild) return;

		const cfg = db.antinuke?.get(guild.id);
		if (!cfg?.enabled || !cfg.antiChannelDeleteEnabled) return;

		// Snapshot the channel before it's gone
		const snapshot = {
			id: channel.id,
			name: channel.name,
			type: channel.type,
			parentId: channel.parentId,
			position: channel.position,
			topic: channel.isTextBased?.() ? channel.topic : null,
			nsfw: channel.isTextBased?.() ? channel.nsfw : false,
			permissionOverwrites: channel.permissionOverwrites?.cache.map(o => ({
				id: o.id, type: o.type,
				allow: o.allow.bitfield.toString(),
				deny: o.deny.bitfield.toString(),
			})) ?? [],
		};

		try {
			const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 });
			const entry = logs.entries.first();
			if (!entry || Date.now() - entry.createdTimestamp > 5000) return;

			const executorId = entry.executor?.id;
			if (!executorId) return;

			await AntinukeEngine.handle(guild, executorId, 'CHANNEL_DELETE', {
				targetId: channel.id,
				targetData: snapshot,
				limit: cfg.antiChannelDeleteLimit,
				interval: cfg.antiChannelDeleteInterval,
				recover: async () => {
					const backup = db.antinuke?.getBackup(guild.id);
					const snap = backup?.channels?.find(c => c.id === channel.id) ?? snapshot;
					await guild.channels.create({
						name: snap.name,
						type: snap.type,
						parent: snap.parentId,
						position: snap.position,
						topic: snap.topic,
						nsfw: snap.nsfw,
						reason: '[Antinuke] Auto-recovery',
					}).catch(() => {});
				},
			});
		} catch (e) {
			logger.error('AntiChannelDelete', e.message);
		}
	},
};
