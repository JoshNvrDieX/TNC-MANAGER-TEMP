import { ReiT } from '#classes/rei';

export class CacheManager {
	constructor(defaultTtl = 300000, maxSize = 50000) {
		this.cache = new ReiT(maxSize);
		this.defaultTtl = defaultTtl;
	}

	get(key) {
		return this.cache.get(key) ?? null;
	}

	set(key, value, ttl) {
		this.cache.set(key, value, ttl ?? Math.ceil(this.defaultTtl / 1000));
	}

	delete(key) {
		this.cache.del(key);
	}

	clear() {
		this.cache.clear();
	}

	sweep() {
	}

	stop() {
		this.cache.clear();
	}
}
