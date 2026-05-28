/**
 * Worker thread task handler.
 * Runs in a separate thread — NO access to Discord client, DB, or cache.
 * Only pure CPU work: serialization, compression, data transformation.
 */
import { parentPort } from 'worker_threads';

parentPort.on('message', ({ task, data }) => {
	try {
		const result = handle(task, data);
		parentPort.postMessage({ data: result });
	} catch (err) {
		parentPort.postMessage({ error: err.message });
	}
});

function handle(task, data) {
	switch (task) {
		// Serialize a backup snapshot to a compact JSON string
		case 'serializeBackup': {
			const { channels, roles, vanityCode } = data;
			return JSON.stringify({ channels, roles, vanityCode });
		}

		// Deserialize a backup snapshot
		case 'deserializeBackup': {
			return JSON.parse(data.raw);
		}

		// Diff two channel arrays — returns added/removed/changed
		case 'diffChannels': {
			const { before, after } = data;
			const beforeMap = new Map(before.map(c => [c.id, c]));
			const afterMap = new Map(after.map(c => [c.id, c]));
			const added = after.filter(c => !beforeMap.has(c.id));
			const removed = before.filter(c => !afterMap.has(c.id));
			const changed = after.filter(c => {
				const b = beforeMap.get(c.id);
				return b && JSON.stringify(b) !== JSON.stringify(c);
			});
			return { added, removed, changed };
		}

		// Diff two role arrays
		case 'diffRoles': {
			const { before, after } = data;
			const beforeMap = new Map(before.map(r => [r.id, r]));
			const afterMap = new Map(after.map(r => [r.id, r]));
			const added = after.filter(r => !beforeMap.has(r.id));
			const removed = before.filter(r => !afterMap.has(r.id));
			return { added, removed };
		}

		// Filter and sort log entries
		case 'processLogs': {
			const { logs, limit } = data;
			return logs
				.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
				.slice(0, limit ?? 20);
		}

		// Check message content against word filter (avoids regex on main thread)
		case 'checkWordFilter': {
			const { content, words } = data;
			const lower = content.toLowerCase();
			const hit = words.find(w => lower.includes(w));
			return { hit: hit ?? null };
		}

		// Check message for scam patterns
		case 'checkScamPatterns': {
			const { content } = data;
			const patterns = [
				/free.?nitro/i, /discord.?gift/i, /steam.?gift/i, /claim.?prize/i,
				/verify.?account/i, /account.?suspended/i, /click.?here.?to.?claim/i,
				/discordgift\./i, /dlscord\./i, /discocrd\./i, /steamcommunity\.ru/i,
				/grabify\.link/i, /iplogger\./i, /blasze\.tk/i,
			];
			return { isScam: patterns.some(p => p.test(content)) };
		}

		default:
			throw new Error(`Unknown task: ${task}`);
	}
}
