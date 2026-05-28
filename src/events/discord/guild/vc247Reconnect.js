import { VC247Manager } from '#classes/vc247Manager';

export default {
	name: 'voiceStateUpdate',
	async execute({ eventArgs }) {
		const [oldState, newState] = eventArgs;
		await VC247Manager.handleDisconnect(oldState, newState).catch(() => {});
	},
};
