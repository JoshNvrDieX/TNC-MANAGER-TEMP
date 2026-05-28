import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data');
const FILE_PATH = join(DATA_DIR, 'tnc.json');

function ensureDefaults(data) {
	if (!data.members) data.members = [];
	if (!data.settings) data.settings = [];
	return data;
}

function load() {
	try {
		if (!existsSync(FILE_PATH)) return { members: [], settings: [] };
		const raw = readFileSync(FILE_PATH, 'utf-8');
		return ensureDefaults(JSON.parse(raw));
	} catch { return { members: [], settings: [] }; }
}

function save(data) {
	mkdirSync(DATA_DIR, { recursive: true });
	writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

let cache = null;

function all() {
	if (cache) return cache;
	cache = load();
	return cache;
}

function flush() {
	save(cache);
}

export const TncSchema = {
	findMember(userId) {
		const data = all();
		const row = data.members.find(m => m.user_id === userId);
		if (!row) return null;
		return {
			userId: row.user_id,
			guildId: row.guild_id,
			realName: row.real_name,
			gameName: row.game_name,
			phoneNumber: row.phone_number,
			activeHours: row.active_hours,
			playingRole: row.playing_role,
			registeredAt: row.registered_at,
			updatedAt: row.updated_at,
		};
	},

	register(userId, guildId, info) {
		const data = all();
		data.members = data.members.filter(m => m.user_id !== userId);
		data.members.push({
			user_id: userId,
			guild_id: guildId,
			real_name: info.realName,
			game_name: info.gameName,
			phone_number: info.phoneNumber,
			active_hours: info.activeHours,
			playing_role: info.playingRole,
			registered_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		});
		flush();
	},

	deleteMember(userId) {
		const data = all();
		data.members = data.members.filter(m => m.user_id !== userId);
		flush();
	},

	getSettings(guildId) {
		const data = all();
		let row = data.settings.find(s => s.guild_id === guildId);
		if (!row) {
			row = { guild_id: guildId, required_role_id: null, apply_channel_id: null };
			data.settings.push(row);
			flush();
		}
		return {
			requiredRoleId: row.required_role_id,
			applyChannelId: row.apply_channel_id,
		};
	},

	setSettings(guildId, updates) {
		const data = all();
		let row = data.settings.find(s => s.guild_id === guildId);
		if (!row) {
			row = { guild_id: guildId, required_role_id: null, apply_channel_id: null };
			data.settings.push(row);
		}
		if (updates.requiredRoleId !== undefined) row.required_role_id = updates.requiredRoleId ?? null;
		if (updates.applyChannelId !== undefined) row.apply_channel_id = updates.applyChannelId ?? null;
		flush();
	},
};
