/**
 * StatusManager — rotating bot status with DB persistence.
 */
import { ActivityType } from 'discord.js';
import { getDb } from '#db/sqlite';
import { logger } from '#utils';

let _interval = null;

const TYPE_MAP = {
	PLAYING:    ActivityType.Playing,
	WATCHING:   ActivityType.Watching,
	LISTENING:  ActivityType.Listening,
	COMPETING:  ActivityType.Competing,
	CUSTOM:     ActivityType.Custom,
};

export class StatusManager {
	static getConfig() {
		const db = getDb();
		let row = db.prepare('SELECT * FROM bot_status WHERE id = 1').get();
		if (!row) {
			db.prepare(`INSERT OR IGNORE INTO bot_status (id) VALUES (1)`).run();
			row = db.prepare('SELECT * FROM bot_status WHERE id = 1').get();
		}
		return {
			enabled: row.enabled === 1,
			type: row.type,
			texts: JSON.parse(row.texts),
			intervalSeconds: row.interval_seconds,
			currentIndex: row.current_index,
		};
	}

	static setConfig(data) {
		const db = getDb();
		StatusManager.getConfig(); // ensure row
		const setClauses = [];
		const values = [];
		if (data.enabled !== undefined) { setClauses.push('enabled = ?'); values.push(data.enabled ? 1 : 0); }
		if (data.type !== undefined) { setClauses.push('type = ?'); values.push(data.type); }
		if (data.texts !== undefined) { setClauses.push('texts = ?'); values.push(JSON.stringify(data.texts)); }
		if (data.intervalSeconds !== undefined) { setClauses.push('interval_seconds = ?'); values.push(data.intervalSeconds); }
		if (data.currentIndex !== undefined) { setClauses.push('current_index = ?'); values.push(data.currentIndex); }
		if (!setClauses.length) return;
		values.push(1);
		db.prepare(`UPDATE bot_status SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
	}

	/**
	 * Start the status rotation loop.
	 * @param {import('discord.js').Client} client
	 */
	static start(client) {
		StatusManager.stop();
		const cfg = StatusManager.getConfig();
		if (!cfg.enabled || !cfg.texts.length) return;

		const rotate = () => {
			const c = StatusManager.getConfig();
			if (!c.enabled || !c.texts.length) return;
			const text = c.texts[c.currentIndex % c.texts.length];
			const activityType = TYPE_MAP[c.type] ?? ActivityType.Custom;

			client.user.setPresence({
				activities: [{ name: text, type: activityType }],
				status: 'online',
			});

			StatusManager.setConfig({ currentIndex: (c.currentIndex + 1) % c.texts.length });
		};

		rotate(); // set immediately
		_interval = setInterval(rotate, (cfg.intervalSeconds || 30) * 1000);
		logger.info('StatusManager', `Status rotation started — ${cfg.texts.length} status(es), every ${cfg.intervalSeconds}s`);
	}

	static stop() {
		if (_interval) {
			clearInterval(_interval);
			_interval = null;
		}
	}

	/** Restart with fresh config (call after any config change). */
	static restart(client) {
		StatusManager.stop();
		StatusManager.start(client);
	}
}
