// Team B — Heap Top-K: bounded min-heap keeps the K best candidates in O(n log k).
const { better } = require('./compare');

class HeapTopK {
  rank(scored, k = scored.length) {
    const heap = []; // root = WORST of the kept candidates
    const worse = (a, b) => better(b, a);

    const up = (i) => {
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (worse(heap[i], heap[p])) { [heap[i], heap[p]] = [heap[p], heap[i]]; i = p; } else break;
      }
    };
    const down = (i) => {
      for (;;) {
        let s = i; const l = 2 * i + 1; const r = l + 1;
        if (l < heap.length && worse(heap[l], heap[s])) s = l;
        if (r < heap.length && worse(heap[r], heap[s])) s = r;
        if (s === i) break;
        [heap[i], heap[s]] = [heap[s], heap[i]]; i = s;
      }
    };

    for (const item of scored) {
      if (heap.length < k) { heap.push(item); up(heap.length - 1); }
      else if (k > 0 && better(item, heap[0])) { heap[0] = item; down(0); }
    }

    const result = [];
    while (heap.length) {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) { heap[0] = last; down(0); }
      result.push(top); // worst first
    }
    result.reverse();
    return result.map((s, i) => ({ ...s, rank: i + 1, algorithm: 'HEAP_TOPK' }));
  }
}

module.exports = HeapTopK;
