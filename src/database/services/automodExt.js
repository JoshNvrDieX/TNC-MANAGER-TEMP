import { AutomodExtSchema } from '#dbSchema/automodExt';

export class AutomodExtService {
	get(guildId) { return AutomodExtSchema.findOrCreate(guildId); }
	set(guildId, data) { AutomodExtSchema.findOrCreate(guildId); AutomodExtSchema.update(guildId, data); }

	// ── Warnings ───────────────────────────────────────────────────────────────
	addWarning(guildId, userId, moderatorId, reason) {
		return AutomodExtSchema.addWarning(guildId, userId, moderatorId, reason);
	}
	getWarningCount(guildId, userId) { return AutomodExtSchema.getWarningCount(guildId, userId); }
	getWarnings(guildId, userId) { return AutomodExtSchema.getWarnings(guildId, userId); }
	clearWarnings(guildId, userId) { AutomodExtSchema.clearWarnings(guildId, userId); }
	removeWarning(guildId, warnId) { AutomodExtSchema.removeWarning(guildId, warnId); }

	// ── Message logs ───────────────────────────────────────────────────────────
	logMessage(guildId, channelId, userId, content, type, oldContent) {
		AutomodExtSchema.logMessage(guildId, channelId, userId, content, type, oldContent);
	}
	getLastDeleted(guildId, channelId, limit) { return AutomodExtSchema.getLastDeleted(guildId, channelId, limit); }
	getLastEdited(guildId, channelId, limit) { return AutomodExtSchema.getLastEdited(guildId, channelId, limit); }
}
