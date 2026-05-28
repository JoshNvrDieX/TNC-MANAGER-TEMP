/**
 * Emoji configuration object
 * Contains all custom emojis used throughout the bot
 * @type {Object}
 * @property {Function} get - Gets emoji by name with optional fallback
 */
export const emoji = {
	check: '<a:tick:1501831530924867695>',
	cross: '<a:tickwrong:1501831623216332882>',
	info: 'ℹ️',
	code: '💻',
	activity: '📊',
	settings: '⚙️',

	/**
	 * Gets an emoji by name with optional fallback
	 *
	 * @param {string} name - The emoji name to retrieve
	 * @param {string} [fallback=''] - Fallback value if emoji not found
	 * @returns {string} The emoji string or fallback
	 */
	get(name, fallback = '') {
		return this[name] || fallback;
	},
};

export default emoji;
