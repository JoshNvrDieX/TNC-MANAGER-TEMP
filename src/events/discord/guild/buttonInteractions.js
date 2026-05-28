/**
 * Global persistent button/select interaction handler.
 * Routes all component interactions to the InteractionRouter.
 * This replaces per-message collectors — buttons never expire.
 */
import { InteractionRouter } from '#classes/interactionRouter';

export default {
	name: 'interactionCreate',
	async execute({ eventArgs }) {
		const [interaction] = eventArgs;
		if (!interaction.guild) return;
		if (!interaction.isButton() && !interaction.isAnySelectMenu() && !interaction.isModalSubmit()) return;
		await InteractionRouter.handle(interaction);
	},
};
