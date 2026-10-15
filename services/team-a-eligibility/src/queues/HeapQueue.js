// Team A — Heap Queue (max-heap variant for scheduling experiments)
// Higher `priority` value is dequeued first; ties are broken by arrival sequence (FIFO).
const PriorityQueue = require('./PriorityQueue');

class HeapQueue extends PriorityQueue {
  constructor() {
    super((a, b) => (b.priority - a.priority) || ((a.seq || 0) - (b.seq || 0)));
  }
}

module.exports = HeapQueue;
