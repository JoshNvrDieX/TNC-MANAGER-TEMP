import { AntinukeSchema } from '#dbSchema/antinuke';
import { smartCache } from '#classes/dbCache';

export class AntinukeService {
	get(guildId) { return AntinukeSchema.findOrCreate(guildId); }
	set(guildId, data) {
		AntinukeSchema.findOrCreate(guildId);
		AntinukeSchema.update(guildId, data);
		smartCache.invalidate('antinuke', guildId);
	}

	isEnabled(guildId) { return this.get(guildId).enabled; }
	setEnabled(guildId, v) { this.set(guildId, { enabled: v }); }

	/** Returns true if the user is the guild owner, in ownerIds, or in trustedAdmins */
	isTrusted(guildId, userId, guildOwnerId) {
		if (userId === guildOwnerId) return true;
		const cfg = this.get(guildId);
		return (cfg.ownerIds ?? []).includes(userId) || (cfg.trustedAdmins ?? []).includes(userId);
	}

	isWhitelistedBot(guildId, botId) {
		return (this.get(guildId).whitelistedBots ?? []).includes(botId);
	}

	addTrusted(guildId, userId) {
		const cfg = this.get(guildId);
		const list = cfg.trustedAdmins ?? [];
		if (!list.includes(userId)) this.set(guildId, { trustedAdmins: [...list, userId] });
	}

	removeTrusted(guildId, userId) {
		const cfg = this.get(guildId);
		this.set(guildId, { trustedAdmins: (cfg.trustedAdmins ?? []).filter(id => id !== userId) });
	}

	addWhitelistedBot(guildId, botId) {
		const cfg = this.get(guildId);
		const list = cfg.whitelistedBots ?? [];
		if (!list.includes(botId)) this.set(guildId, { whitelistedBots: [...list, botId] });
	}

	removeWhitelistedBot(guildId, botId) {
		const cfg = this.get(guildId);
		this.set(guildId, { whitelistedBots: (cfg.whitelistedBots ?? []).filter(id => id !== botId) });
	}

	saveBackup(guildId, channels, roles, vanityCode, metadata = {}) {
		return AntinukeSchema.saveBackup(guildId, channels, roles, vanityCode, metadata);
	}

	getBackup(guildId) { return AntinukeSchema.getBackup(guildId); }

	getAllBackups() { return AntinukeSchema.getAllBackups(); }

	logAction(guildId, executorId, actionType, targetId, targetData) {
		AntinukeSchema.logAction(guildId, executorId, actionType, targetId, targetData);
	}

	getRecentLogs(guildId, limit = 20) { return AntinukeSchema.getRecentLogs(guildId, limit); }
}
