/**
 * VC247Manager — keeps the bot in a voice channel 24/7.
 * Handles initial join, auto-reconnect on disconnect/kick,
 * and persists config in SQLite.
 */
import { getDb } from '#db/sqlite';
import { logger } from '#utils';

// In-memory state per guild
const state = new Map(); // guildId → { channelId, reconnecting }

export class VC247Manager {
	// ── DB helpers ─────────────────────────────────────────────────────────────

	static getConfig(guildId) {
		const db = getDb();
		let row = db.prepare('SELECT * FROM vc247 WHERE guild_id = ?').get(guildId);
		if (!row) {
			db.prepare('INSERT OR IGNORE INTO vc247 (guild_id) VALUES (?)').run(guildId);
			row = db.prepare('SELECT * FROM vc247 WHERE guild_id = ?').get(guildId);
		}
		return {
			guildId: row.guild_id,
			enabled: row.enabled === 1,
			channelId: row.channel_id,
			channelStatus: row.channel_status ?? null,
		};
	}

	static setConfig(guildId, data) {
		const db = getDb();
		VC247Manager.getConfig(guildId); // ensure row
		const setClauses = [];
		const values = [];
		if (data.enabled !== undefined) { setClauses.push('enabled = ?'); values.push(data.enabled ? 1 : 0); }
		if (data.channelId !== undefined) { setClauses.push('channel_id = ?'); values.push(data.channelId); }
		if (data.channelStatus !== undefined) { setClauses.push('channel_status = ?'); values.push(data.channelStatus); }
		if (!setClauses.length) return;
		setClauses.push(`updated_at = datetime('now')`);
		values.push(guildId);
		db.prepare(`UPDATE vc247 SET ${setClauses.join(', ')} WHERE guild_id = ?`).run(...values);
	}

	// ── Join / Leave ───────────────────────────────────────────────────────────

	/**
	 * Join the configured VC for a guild.
	 * @param {import('discord.js').Guild} guild
	 * @returns {Promise<boolean>} true if joined
	 */
	static async join(guild) {
		const cfg = VC247Manager.getConfig(guild.id);
		if (!cfg.channelId) return false;

		const channel = guild.channels.cache.get(cfg.channelId);
		if (!channel?.isVoiceBased()) return false;

		try {
			const { joinVoiceChannel } = await import('@discordjs/voice');
			const conn = joinVoiceChannel({
				channelId: channel.id,
				guildId: guild.id,
				adapterCreator: guild.voiceAdapterCreator,
				selfDeaf: true,
				selfMute: true,
			});

			state.set(guild.id, { channelId: channel.id, reconnecting: false });
			logger.info('VC247', `Joined ${channel.name} in ${guild.name}`);

			// Re-apply channel status if one was saved
			if (cfg.channelStatus) {
				await VC247Manager.setChannelStatus(guild, channel.id, cfg.channelStatus).catch(() => {});
			}

			return true;
		} catch (e) {
			logger.error('VC247', `Failed to join VC in ${guild.name}: ${e.message}`);
			return false;
		}
	}

	/**
	 * Leave VC and disable 24/7 for a guild.
	 * @param {import('discord.js').Guild} guild
	 */
	static async leave(guild) {
		try {
			const { getVoiceConnection } = await import('@discordjs/voice');
			const conn = getVoiceConnection(guild.id);
			if (conn) conn.destroy();
		} catch {}
		state.delete(guild.id);
		VC247Manager.setConfig(guild.id, { enabled: false });
		logger.info('VC247', `Left VC in ${guild.name}`);
	}

	/**
	 * Auto-reconnect handler — call from voiceStateUpdate event.
	 * @param {import('discord.js').VoiceState} oldState
	 * @param {import('discord.js').VoiceState} newState
	 */
	static async handleDisconnect(oldState, newState) {
		const guild = newState.guild;
		const cfg = VC247Manager.getConfig(guild.id);
		if (!cfg.enabled || !cfg.channelId) return;

		// Check if it's the bot that was disconnected
		if (newState.member?.id !== guild.client.user.id) return;
		if (newState.channelId !== null) return; // still in a channel

		const guildState = state.get(guild.id);
		if (guildState?.reconnecting) return;

		// Mark as reconnecting to avoid duplicate attempts
		state.set(guild.id, { channelId: cfg.channelId, reconnecting: true });
		logger.warn('VC247', `Disconnected from VC in ${guild.name}, reconnecting in 3s...`);

		setTimeout(async () => {
			const s = state.get(guild.id);
			if (s) s.reconnecting = false;
			await VC247Manager.join(guild);
		}, 3000);
	}

	/**
	 * Set the voice channel status text (the "Set a channel status" feature).
	 * Saves to DB so it's restored on reconnect.
	 * @param {import('discord.js').Guild} guild
	 * @param {string} channelId
	 * @param {string|null} status - null to clear
	 */
	static async setChannelStatus(guild, channelId, status) {
		try {
			// Discord REST endpoint for channel status
			await guild.client.rest.put(
				`/channels/${channelId}/voice-status`,
				{ body: { status: status ?? '' } },
			);
			VC247Manager.setConfig(guild.id, { channelStatus: status ?? null });
			logger.info('VC247', `Channel status set: "${status}" in ${guild.name}`);
		} catch (e) {
			logger.error('VC247', `Failed to set channel status: ${e.message}`);
			throw e;
		}
	}

	/**
	 * Resume all enabled 24/7 VCs on bot startup.
	 * @param {import('discord.js').Client} client
	 */
	static async resumeAll(client) {
		const db = getDb();
		const rows = db.prepare('SELECT * FROM vc247 WHERE enabled = 1 AND channel_id IS NOT NULL').all();
		for (const row of rows) {
			const guild = client.guilds.cache.get(row.guild_id);
			if (!guild) continue;
			await VC247Manager.join(guild).catch(() => {});
		}
		if (rows.length) logger.info('VC247', `Resumed ${rows.length} 24/7 VC connection(s)`);
	}
}
