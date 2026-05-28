/**
 * WorkerPool — a simple fixed-size pool of Node.js worker threads.
 * Offloads CPU-heavy tasks (backup serialization, bulk processing)
 * off the main event loop thread.
 *
 * Usage:
 *   const result = await pool.run('taskName', { ...data });
 */
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from '#utils';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_SCRIPT = join(__dirname, 'workerTasks.js');

export class WorkerPool {
	/**
	 * @param {number} [size=2] - Number of worker threads to keep alive.
	 */
	constructor(size = 2) {
		this.size = size;
		/** @type {Worker[]} idle workers */
		this._idle = [];
		/** @type {Array<{resolve, reject, task, data}>} queued jobs */
		this._queue = [];
		this._initialized = false;
	}

	/** Spawn all workers. Call once at startup. */
	init() {
		if (this._initialized) return;
		for (let i = 0; i < this.size; i++) {
			this._idle.push(this._spawn());
		}
		this._initialized = true;
		logger.info('WorkerPool', `Started ${this.size} worker threads`);
	}

	/**
	 * Run a named task in a worker thread.
	 * @param {string} task - Task name (must be handled in workerTasks.js)
	 * @param {Object} data - Serializable input data
	 * @returns {Promise<any>}
	 */
	run(task, data = {}) {
		return new Promise((resolve, reject) => {
			const job = { task, data, resolve, reject };
			const worker = this._idle.pop();
			if (worker) {
				this._dispatch(worker, job);
			} else {
				this._queue.push(job);
			}
		});
	}

	/** @private */
	_spawn() {
		const worker = new Worker(WORKER_SCRIPT);
		worker.on('error', err => logger.error('WorkerPool', `Worker error: ${err.message}`));
		worker.on('exit', code => {
			if (code !== 0) {
				logger.warn('WorkerPool', `Worker exited with code ${code}, respawning`);
				const replacement = this._spawn();
				this._idle.push(replacement);
			}
		});
		return worker;
	}

	/** @private */
	_dispatch(worker, job) {
		worker.once('message', result => {
			if (result.error) {
				job.reject(new Error(result.error));
			} else {
				job.resolve(result.data);
			}
			// Return worker to pool or process next queued job
			const next = this._queue.shift();
			if (next) {
				this._dispatch(worker, next);
			} else {
				this._idle.push(worker);
			}
		});
		worker.postMessage({ task: job.task, data: job.data });
	}

	/** Terminate all workers. */
	async destroy() {
		for (const w of this._idle) await w.terminate();
		this._idle = [];
		this._initialized = false;
	}
}

/** Singleton pool — 2 workers by default */
export const pool = new WorkerPool(2);
