// Team B — Hash index (separate chaining, FNV-1a, dynamic resize) used for shortlist lookups. O(1) average.

function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

class HashIndex {
  constructor(capacity = 64) {
    this.buckets = new Array(capacity).fill(null).map(() => []);
    this.size = 0;
  }

  _resize() {
    const old = this.buckets;
    this.buckets = new Array(old.length * 2).fill(null).map(() => []);
    this.size = 0;
    for (const b of old) for (const [k, v] of b) this.set(k, v);
  }

  set(key, value) {
    const b = this.buckets[fnv1a(key) % this.buckets.length];
    for (const entry of b) if (entry[0] === key) { entry[1] = value; return; }
    b.push([key, value]);
    this.size++;
    if (this.size / this.buckets.length > 0.75) this._resize();
  }

  get(key) {
    const b = this.buckets[fnv1a(key) % this.buckets.length];
    for (const entry of b) if (entry[0] === key) return entry[1];
    return undefined;
  }

  delete(key) {
    const b = this.buckets[fnv1a(key) % this.buckets.length];
    const i = b.findIndex(e => e[0] === key);
    if (i === -1) return false;
    b.splice(i, 1);
    this.size--;
    return true;
  }

  deletePrefix(prefix) {
    let n = 0;
    for (const b of this.buckets) {
      for (let i = b.length - 1; i >= 0; i--) {
        if (b[i][0].startsWith(prefix)) { b.splice(i, 1); this.size--; n++; }
      }
    }
    return n;
  }

  clear() { this.buckets = new Array(64).fill(null).map(() => []); this.size = 0; }
  loadFactor() { return Number((this.size / this.buckets.length).toFixed(3)); }
  memoryBytes() { return this.buckets.length * 24 + this.size * 48; }
}

module.exports = HashIndex;
