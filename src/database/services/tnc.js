import { TncSchema } from '#dbSchema/tnc';

export class TncService {
	get(userId) { return TncSchema.findMember(userId); }
	register(userId, guildId, data) { TncSchema.register(userId, guildId, data); }
	delete(userId) { TncSchema.deleteMember(userId); }
	getSettings(guildId) { return TncSchema.getSettings(guildId); }
	setSettings(guildId, data) { TncSchema.setSettings(guildId, data); }
}
