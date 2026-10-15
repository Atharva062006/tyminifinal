// Team A — Interview-slot lease manager (A3).
// Simulates mutex / reader-writer semaphores with leases, a wait-for graph and deadlock detection.
// Guarantee: an EXCLUSIVE slot is never granted to two holders at the same time (single-threaded
// event loop + synchronous grant path => no race window).
const { v4: uuidv4 } = require('uuid');

class WaitForGraph {
  constructor() { this.edges = new Map(); } // waiter -> Set(holder)

  add(waiter, holder) {
    if (waiter === holder) return;
    if (!this.edges.has(waiter)) this.edges.set(waiter, new Set());
    this.edges.get(waiter).add(holder);
  }

  removeWaiter(waiter) { this.edges.delete(waiter); }

  removeNode(node) {
    this.edges.delete(node);
    for (const set of this.edges.values()) set.delete(node);
  }

  /** DFS cycle detection. Returns the list of distinct cycles found (each as array of nodes). */
  findCycles() {
    const cycles = [];
    const state = new Map(); // 0/undefined = unvisited, 1 = on stack, 2 = done
    const stack = [];
    const seen = new Set();
    const visit = (n) => {
      state.set(n, 1);
      stack.push(n);
      for (const m of this.edges.get(n) || []) {
        if (state.get(m) === 1) {
          const cyc = stack.slice(stack.indexOf(m));
          const key = [...cyc].sort().join('|');
          if (!seen.has(key)) { seen.add(key); cycles.push(cyc); }
        } else if (!state.get(m)) {
          visit(m);
        }
      }
      stack.pop();
      state.set(n, 2);
    };
    for (const n of this.edges.keys()) if (!state.get(n)) visit(n);
    return cycles;
  }

  static fromEdgeList(list) {
    const g = new WaitForGraph();
    for (const [a, b] of list) g.add(a, b);
    return g;
  }
}

class LockManager {
  constructor({ defaultLeaseMs = 30000, sweepMs = 1000 } = {}) {
    this.defaultLeaseMs = defaultLeaseMs;
    this.slots = new Map();   // slot_id -> { holders: Map(lease_id -> lease), waiters: [] }
    this.leases = new Map();  // lease_id -> lease
    this.graph = new WaitForGraph();
    this.stats = { granted: 0, conflicts: 0, deadlocks_detected: 0, deadlocks_resolved: 0, expired: 0, released: 0 };
    this.onEvent = () => {};
    this._sweeper = setInterval(() => this.sweepExpired(), sweepMs);
    if (this._sweeper.unref) this._sweeper.unref();
  }

  _slot(id) {
    if (!this.slots.has(id)) this.slots.set(id, { holders: new Map(), waiters: [] });
    return this.slots.get(id);
  }

  _compatible(slot, mode) {
    if (slot.holders.size === 0) return true;
    if (mode === 'EXCLUSIVE') return false;
    for (const l of slot.holders.values()) if (l.mode === 'EXCLUSIVE') return false;
    return true;
  }

  _grant(slotId, holderId, mode, leaseMs, meta) {
    const slot = this._slot(slotId);
    const lease = {
      lease_id: `LSE-${uuidv4().substring(0, 8)}`,
      slot_id: slotId,
      holder_id: holderId,
      mode,
      acquired_at: new Date().toISOString(),
      expires_at: Date.now() + leaseMs,
      meta: meta || null,
    };
    slot.holders.set(lease.lease_id, lease);
    this.leases.set(lease.lease_id, lease);
    this.graph.removeWaiter(holderId);
    this.stats.granted++;
    this.onEvent('lease_granted', { lease_id: lease.lease_id, slot_id: slotId, holder_id: holderId });
    return lease;
  }

  /**
   * Try to acquire a slot. With wait=false (default) a conflict returns immediately.
   * With wait=true the caller is queued on the wait-for graph; a deadlock is prevented by
   * rejecting the requester that closes the cycle.
   */
  async acquire({ slot_id, holder_id, mode = 'EXCLUSIVE', lease_timeout_ms, wait = false, wait_timeout_ms = 2000, meta }) {
    if (!slot_id || !holder_id) {
      return { lock_granted: false, conflict_reason: 'slot_id and holder_id are required' };
    }
    const m = mode === 'SHARED' ? 'SHARED' : 'EXCLUSIVE';
    const leaseMs = lease_timeout_ms || this.defaultLeaseMs;
    const slot = this._slot(slot_id);

    // Re-entrant: same holder already owns this slot -> return existing lease (idempotent)
    for (const l of slot.holders.values()) {
      if (l.holder_id === holder_id) return this._view(l, true);
    }

    if (this._compatible(slot, m) && slot.waiters.length === 0) {
      return this._view(this._grant(slot_id, holder_id, m, leaseMs, meta), true);
    }

    this.stats.conflicts++;
    const holders = [...slot.holders.values()].map(l => l.holder_id);
    if (!wait) {
      return {
        lock_granted: false, lease_id: null,
        conflict_reason: `Slot '${slot_id}' is held by ${holders.join(', ')}`,
        deadlock_cycle: null, prevention_or_recovery_action: 'RETRY_LATER',
      };
    }

    for (const h of holders) this.graph.add(holder_id, h);
    const cycles = this.graph.findCycles().filter(c => c.includes(holder_id));
    if (cycles.length) {
      this.graph.removeWaiter(holder_id);
      this.stats.deadlocks_detected++;
      this.stats.deadlocks_resolved++;
      this.onEvent('deadlock_prevented', { cycle: cycles[0], victim: holder_id });
      return {
        lock_granted: false, lease_id: null,
        conflict_reason: 'Granting this wait would create a deadlock',
        deadlock_cycle: cycles[0], prevention_or_recovery_action: 'REQUESTER_ABORTED',
      };
    }

    return new Promise(resolve => {
      const waiter = { holder_id, mode: m, leaseMs, meta, resolve, timer: null };
      waiter.timer = setTimeout(() => {
        slot.waiters = slot.waiters.filter(w => w !== waiter);
        this.graph.removeWaiter(holder_id);
        resolve({
          lock_granted: false, lease_id: null, conflict_reason: `Timed out waiting for slot '${slot_id}'`,
          deadlock_cycle: null, prevention_or_recovery_action: 'WAIT_TIMEOUT',
        });
      }, wait_timeout_ms);
      slot.waiters.push(waiter);
    });
  }

  _promote(slotId) {
    const slot = this.slots.get(slotId);
    if (!slot) return;
    while (slot.waiters.length) {
      const w = slot.waiters[0];
      if (!this._compatible(slot, w.mode)) break;
      slot.waiters.shift();
      clearTimeout(w.timer);
      w.resolve(this._view(this._grant(slotId, w.holder_id, w.mode, w.leaseMs, w.meta), true));
    }
  }

  release(leaseId, reason = 'RELEASED') {
    const lease = this.leases.get(leaseId);
    if (!lease) return false;
    const slot = this.slots.get(lease.slot_id);
    if (slot) slot.holders.delete(leaseId);
    this.leases.delete(leaseId);
    this.graph.removeNode(lease.holder_id);
    this.stats.released++;
    this.onEvent('lease_released', { lease_id: leaseId, slot_id: lease.slot_id, reason });
    this._promote(lease.slot_id);
    return true;
  }

  sweepExpired() {
    const now = Date.now();
    for (const lease of [...this.leases.values()]) {
      if (lease.expires_at <= now) {
        this.stats.expired++;
        this.release(lease.lease_id, 'EXPIRED');
      }
    }
  }

  _view(l, granted) {
    return {
      lock_granted: granted, lease_id: l.lease_id, slot_id: l.slot_id, holder_id: l.holder_id, mode: l.mode,
      acquired_at: l.acquired_at, expires_at: new Date(l.expires_at).toISOString(),
      conflict_reason: null, deadlock_cycle: null, prevention_or_recovery_action: 'NONE',
    };
  }

  list() {
    return [...this.leases.values()].map(l => this._view(l, true));
  }

  activeCount() { return this.leases.size; }

  waitingCount() {
    let n = 0;
    for (const s of this.slots.values()) n += s.waiters.length;
    return n;
  }

  /**
   * Analyse a supplied wait-for edge list (seeded deadlock scenarios) or the live graph.
   * Recovery: the victim is the lexicographically greatest node on each cycle (deterministic).
   */
  analyse(edgeList) {
    const t0 = process.hrtime.bigint();
    const g = Array.isArray(edgeList) && edgeList.length ? WaitForGraph.fromEdgeList(edgeList) : this.graph;
    const cycles = g.findCycles();
    const actions = cycles.map(c => ({ cycle: c, victim: [...c].sort().pop(), action: 'ABORT_VICTIM_AND_RELEASE_LEASES' }));
    if (!(Array.isArray(edgeList) && edgeList.length)) {
      for (const a of actions) {
        this.graph.removeNode(a.victim);
        for (const l of [...this.leases.values()]) if (l.holder_id === a.victim) this.release(l.lease_id, 'DEADLOCK_VICTIM');
        this.stats.deadlocks_detected++;
        this.stats.deadlocks_resolved++;
      }
    }
    return {
      deadlock_detected: cycles.length > 0,
      cycles,
      recovery_actions: actions,
      analysis_time_ms: Number(process.hrtime.bigint() - t0) / 1e6,
    };
  }

  shutdown() { clearInterval(this._sweeper); }
}

module.exports = { LockManager, WaitForGraph };
