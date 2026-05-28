import { logger } from '#utils';
import { ComponentType, ButtonStyle, MessageFlags } from 'discord.js';

/**
 * Edits a message or interaction to disable all interactive components.
 * Link buttons are left enabled since they can't be interacted with in the usual sense.
 * Silently ignores Discord errors for unknown messages, channels, or missing access.
 * @param {import('discord.js').Message|import('discord.js').Interaction} target
 * @returns {Promise<void>}
 */
export async function disableComponents(target) {
	try {
		if (!target) return;
		
		const components = target.components || (target.message ? target.message.components : []);
		if (!components || !components.length) return;

		const disabled = components.map((c) => {
			const j = c.toJSON();

			if (c.type === ComponentType.ActionRow) {
				j.components = c.components.map((s) => {
					const sj = s.toJSON();
					return sj.type === ComponentType.Button && sj.style === ButtonStyle.Link
						? sj
						: { ...sj, disabled: true };
				});
			} else if ([ComponentType.Container, ComponentType.Section].includes(c.type)) {
				j.components = _disableNested(c.components);

				if (c.accessory?.type === ComponentType.Button) {
					const aj = c.accessory.toJSON();
					j.accessory = aj.style === ButtonStyle.Link ? aj : { ...aj, disabled: true };
				}
			}

			return j;
		});

		const payload = {
			components: disabled,
			flags: MessageFlags.IsComponentsV2,
		};

		if (target.edit && typeof target.edit === 'function') {
			await target.edit(payload);
		} else if (target.editReply && typeof target.editReply === 'function') {
			await target.editReply(payload);
		}
	} catch (err) {
		// 10008 = unknown message, 10003 = unknown channel, 50001 = missing access, 
		// 10015 = unknown webhook, 40060 = interaction has already been acknowledged
		const ignoredCodes = [10008, 10003, 50001, 10015, 40060, 50027];
		if (!ignoredCodes.includes(err.code)) {
			// Silently fail for most interaction/message errors during timeout
			// logger.error('Utils', 'disableComponents error', err);
		}
	}
}

/**
 * Automatically attaches an 'end' listener to a collector to disable components.
 * @param {import('discord.js').InteractionCollector} collector
 * @param {import('discord.js').Message|import('discord.js').Interaction} target
 */
export function autoDisable(collector, target) {
	collector.on('end', () => disableComponents(target).catch(() => {}));
}

/**
 * Recursively disables buttons inside Container and Section components.
 * Link buttons are preserved as-is.
 * @param {import('discord.js').Component[]} comps
 * @returns {Object[]} Serialised component data with buttons disabled.
 */
export function _disableNested(comps) {
	return comps.map((c) => {
		const j = c.toJSON();

		if (c.type === ComponentType.ActionRow) {
			j.components = c.components.map((s) => {
				const sj = s.toJSON();
				return sj.type === ComponentType.Button && sj.style === ButtonStyle.Link
					? sj
					: { ...sj, disabled: true };
			});
		} else if ([ComponentType.Container, ComponentType.Section].includes(c.type)) {
			j.components = _disableNested(c.components);

			if (c.accessory?.type === ComponentType.Button) {
				const aj = c.accessory.toJSON();
				j.accessory = aj.style === ButtonStyle.Link ? aj : { ...aj, disabled: true };
			}
		}

		return j;
	});
}

