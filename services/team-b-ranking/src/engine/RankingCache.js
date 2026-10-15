// Team B — Version-aware ranking cache (B3). Keys embed graph_version so stale entries can never be served;
// explicit invalidation by drive is also supported (target: < 2 s, in practice O(entries)).
class RankingCache {
  constructor({ ttlMs = 5 * 60 * 1000, max = 500 } = {}) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.map = new Map();
    this.hits = 0;
    this.misses = 0;
    this.invalidations = 0;
    this.lastInvalidationMs = 0;
  }

  get(key) {
    const e = this.map.get(key);
    if (!e || e.expires < Date.now()) {
      if (e) this.map.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return e.value;
  }

  set(key, value, driveId) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value);
    this.map.set(key, { value, driveId, expires: Date.now() + this.ttlMs });
  }

  invalidate({ drive_id } = {}) {
    const t0 = process.hrtime.bigint();
    let n = 0;
    for (const [k, e] of [...this.map.entries()]) {
      if (!drive_id || e.driveId === drive_id) { this.map.delete(k); n++; }
    }
    this.invalidations += n;
    this.lastInvalidationMs = Number(process.hrtime.bigint() - t0) / 1e6;
    return { invalidated: n, took_ms: this.lastInvalidationMs };
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      entries: this.map.size,
      hits: this.hits,
      misses: this.misses,
      hit_rate_pct: total ? Number(((this.hits / total) * 100).toFixed(1)) : 0,
      invalidations: this.invalidations,
      last_invalidation_ms: this.lastInvalidationMs,
    };
  }
}

module.exports = RankingCache;
