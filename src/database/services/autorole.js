import { AutoroleSchema } from '#dbSchema/autorole';

export class AutoroleService {
	get(guildId) { return AutoroleSchema.findOrCreate(guildId); }
	set(guildId, data) { AutoroleSchema.findOrCreate(guildId); AutoroleSchema.update(guildId, data); }
	setEnabled(guildId, v) { this.set(guildId, { enabled: v }); }
}
