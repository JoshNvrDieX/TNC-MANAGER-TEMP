export class Rei {
	constructor(max = 50000) {
		this.$ = new Map();
		this.max = max;
		this.hits = 0;
		this.misses = 0;
		this.evictions = 0;
	}

	_markUsed(k) {
		if (this.$.has(k)) {
			const v = this.$.get(k);
			this.$.delete(k);
			this.$.set(k, v);
		}
	}

	_evictIfNeeded() {
		if (this.$.size >= this.max) {
			const first = this.$.keys().next().value;
			if (first !== undefined) {
				this.$.delete(first);
				this.evictions++;
			}
		}
	}

	set(k, v) {
		if (this.$.has(k)) {
			this.$.delete(k);
		} else {
			this._evictIfNeeded();
		}
		this.$.set(k, v);
		return this;
	}

	get(k) {
		const v = this.$.get(k);
		if (v === undefined) {
			this.misses++;
			return undefined;
		}
		this.hits++;
		this.$.delete(k);
		this.$.set(k, v);
		return v;
	}

	has(k) {
		return this.$.has(k);
	}

	del(k) {
		return this.$.delete(k);
	}

	delete(k) {
		return this.$.delete(k);
	}

	clear() {
		this.$.clear();
		this.hits = 0;
		this.misses = 0;
		this.evictions = 0;
		return this;
	}

	peek(k) {
		return this.$.get(k);
	}

	mset(arr) {
		for (let i = 0; i < arr.length; i++) {
			this.set(arr[i][0], arr[i][1]);
		}
		return this;
	}

	setMany(arr) {
		return this.mset(arr);
	}

	mget(keys) {
		const out = new Array(keys.length);
		for (let i = 0; i < keys.length; i++) {
			out[i] = this.get(keys[i]);
		}
		return out;
	}

	getMany(keys) {
		return this.mget(keys);
	}

	mdel(keys) {
		for (let i = 0; i < keys.length; i++) {
			this.$.delete(keys[i]);
		}
		return this;
	}

	deleteMany(keys) {
		return this.mdel(keys);
	}

	exists(k) {
		return this.$.has(k);
	}

	peekHas(k) {
		return this.$.has(k);
	}

	getOr(k, d) {
		const v = this.$.get(k);
		if (v === undefined) {
			this.misses++;
			return d;
		}
		this.hits++;
		this.$.delete(k);
		this.$.set(k, v);
		return v;
	}

	setnx(k, v) {
		if (!this.$.has(k)) {
			this.set(k, v);
			return 1;
		}
		return 0;
	}

	setNX(k, v) {
		if (!this.$.has(k)) {
			this.set(k, v);
			return true;
		}
		return false;
	}

	incr(k, d = 1) {
		const v = this.$.get(k);
		if (v === undefined) {
			this.set(k, d);
			return d;
		}
		const n = +v + d;
		this.set(k, n);
		return n;
	}

	incrby(k, d) {
		return this.incr(k, d);
	}

	decr(k, d = 1) {
		return this.incr(k, -d);
	}

	decrby(k, d) {
		return this.incr(k, -d);
	}

	pop(k) {
		const v = this.$.get(k);
		if (v !== undefined) {
			this.$.delete(k);
			return v;
		}
		return undefined;
	}

	keys(pattern) {
		if (!pattern || pattern === '*') {
			return Array.from(this.$.keys());
		}
		const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
		const regex = new RegExp(`^${escaped}$`);
		const matches = [];
		for (const k of this.$.keys()) {
			if (regex.test(k)) matches.push(k);
		}
		return matches;
	}

	values() {
		return Array.from(this.$.values());
	}

	entries() {
		return Array.from(this.$.entries());
	}

	hset(k, f, v) {
		let h = this.$.get(k);
		if (!h || typeof h !== 'object' || Array.isArray(h) || h instanceof Set) {
			h = {};
			this.set(k, h);
		}
		h[f] = v;
		return this;
	}

	hget(k, f) {
		const h = this.$.get(k);
		return h && typeof h === 'object' && !Array.isArray(h) && !(h instanceof Set)
			? h[f]
			: undefined;
	}

	hdel(k, f) {
		const h = this.$.get(k);
		if (h && typeof h === 'object' && !Array.isArray(h) && !(h instanceof Set)) {
			delete h[f];
			return true;
		}
		return false;
	}

	hgetall(k) {
		const h = this.$.get(k);
		return h && typeof h === 'object' && !Array.isArray(h) && !(h instanceof Set)
			? h
			: {};
	}

	hmset(k, obj) {
		let h = this.$.get(k);
		if (!h || typeof h !== 'object' || Array.isArray(h) || h instanceof Set) {
			h = {};
			this.set(k, h);
		}
		Object.assign(h, obj);
		return this;
	}

	hmget(k, fields) {
		const h = this.$.get(k);
		if (!h || typeof h !== 'object' || Array.isArray(h) || h instanceof Set) {
			return fields.map(() => undefined);
		}
		const out = new Array(fields.length);
		for (let i = 0; i < fields.length; i++) {
			out[i] = h[fields[i]];
		}
		return out;
	}

	hincrby(k, f, d = 1) {
		let h = this.$.get(k);
		if (!h || typeof h !== 'object' || Array.isArray(h) || h instanceof Set) {
			h = {};
			this.set(k, h);
		}
		const v = h[f];
		const n = (v === undefined ? 0 : +v) + d;
		h[f] = n;
		return n;
	}

	sadd(k, ...members) {
		let s = this.$.get(k);
		if (!s || !(s instanceof Set)) {
			s = new Set();
			this.set(k, s);
		}
		for (let i = 0; i < members.length; i++) {
			s.add(members[i]);
		}
		return this;
	}

	smembers(k) {
		const s = this.$.get(k);
		return s instanceof Set ? Array.from(s) : [];
	}

	sismember(k, m) {
		const s = this.$.get(k);
		return s instanceof Set ? s.has(m) : false;
	}

	srem(k, ...members) {
		const s = this.$.get(k);
		if (s instanceof Set) {
			for (let i = 0; i < members.length; i++) {
				s.delete(members[i]);
			}
		}
		return this;
	}

	lpush(k, ...values) {
		let arr = this.$.get(k);
		if (!Array.isArray(arr)) {
			arr = [];
			this.set(k, arr);
		}
		arr.unshift(...values);
		return arr.length;
	}

	rpush(k, ...values) {
		let arr = this.$.get(k);
		if (!Array.isArray(arr)) {
			arr = [];
			this.set(k, arr);
		}
		arr.push(...values);
		return arr.length;
	}

	lpop(k) {
		const arr = this.$.get(k);
		return Array.isArray(arr) ? arr.shift() : undefined;
	}

	rpop(k) {
		const arr = this.$.get(k);
		return Array.isArray(arr) ? arr.pop() : undefined;
	}

	lrange(k, start, stop) {
		const arr = this.$.get(k);
		if (!Array.isArray(arr)) return [];
		const end = stop === -1 ? arr.length : stop + 1;
		return arr.slice(start, end);
	}

	llen(k) {
		const arr = this.$.get(k);
		return Array.isArray(arr) ? arr.length : 0;
	}

	get size() {
		return this.$.size;
	}

	get length() {
		return this.$.size;
	}

	dbsize() {
		return this.$.size;
	}

	flushdb() {
		return this.clear();
	}

	flushall() {
		return this.clear();
	}

	stats() {
		return {
			size: this.$.size,
			max: this.max,
			hits: this.hits,
			misses: this.misses,
			evictions: this.evictions,
			hitRate: this.hits + this.misses > 0
				? (this.hits / (this.hits + this.misses) * 100).toFixed(1) + '%'
				: '0%',
		};
	}

	resetStats() {
		this.hits = 0;
		this.misses = 0;
		this.evictions = 0;
	}
}

export class ReiT extends Rei {
	constructor(max = 5000) {
		super(max);
		this.ttlMap = new Map();
		this.intervals = new Map();
	}

	set(k, v, ttl) {
		const existingTimeout = this.intervals.get(k);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
			this.intervals.delete(k);
			this.ttlMap.delete(k);
		}
		super.set(k, v);
		if (ttl) {
			this.expire(k, ttl);
		}
		return this;
	}

	expire(k, seconds) {
		const existing = this.intervals.get(k);
		if (existing) clearTimeout(existing);

		const timeout = setTimeout(() => {
			this.$.delete(k);
			this.ttlMap.delete(k);
			this.intervals.delete(k);
		}, seconds * 1000);

		if (timeout.unref) timeout.unref();

		this.intervals.set(k, timeout);
		this.ttlMap.set(k, Date.now() + seconds * 1000);
		return this;
	}

	ttl(k) {
		const expiry = this.ttlMap.get(k);
		if (!expiry) return -1;
		const remaining = Math.ceil((expiry - Date.now()) / 1000);
		return remaining > 0 ? remaining : -2;
	}

	clear() {
		for (const timeout of this.intervals.values()) {
			clearTimeout(timeout);
		}
		this.intervals.clear();
		this.ttlMap.clear();
		super.clear();
		return this;
	}

	del(k) {
		const timeout = this.intervals.get(k);
		if (timeout) {
			clearTimeout(timeout);
			this.intervals.delete(k);
		}
		this.ttlMap.delete(k);
		return super.del(k);
	}

	delete(k) {
		return this.del(k);
	}
}
