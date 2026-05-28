/**
 * Global persistent interaction router.
 * Handles ALL button/select interactions from config panels so they
 * never expire — no collectors, no timeouts, buttons work forever.
 *
 * Each command registers its handler here via InteractionRouter.register().
 * The discord interactionCreate event calls InteractionRouter.handle().
 */

import { MessageFlags } from 'discord.js';

/** @type {Map<string, (i: import('discord.js').Interaction) => Promise<void>>} */
const _handlers = new Map();

export const InteractionRouter = {
	/**
	 * Register a prefix → handler function.
	 * @param {string} prefix  - customId prefix e.g. 'am', 'an', 'lg'
	 * @param {(i) => Promise<void>} fn
	 */
	register(prefix, fn) {
		_handlers.set(prefix, fn);
	},

	/**
	 * Route an interaction to the correct handler.
	 * @param {import('discord.js').Interaction} interaction
	 */
	async handle(interaction) {
		if (!interaction.isButton() && !interaction.isAnySelectMenu() && !interaction.isModalSubmit()) return;

		const prefix = interaction.customId.split('|')[1]
			? interaction.customId.split('|')[0]
			: null;

		if (!prefix) return;

		const handler = _handlers.get(prefix);
		if (!handler) return;

		try {
			await handler(interaction);
		} catch (e) {
			// Silently ignore already-acknowledged interactions
			if (e.code === 10062 || e.code === 40060) return;
			console.error(`[InteractionRouter] Error in handler "${prefix}":`, e.message);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: '❌ Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
			}
		}
	},
};
