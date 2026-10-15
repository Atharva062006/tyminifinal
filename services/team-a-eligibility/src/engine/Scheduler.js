// Team A — Request intake + queue management (A1) and runtime state (A4).
// Per-drive queues with a pluggable policy (FIFO | CIRCULAR | PRIORITY | HEAP). A single worker drains
// the drives round-robin. Aging prevents starvation: any request waiting longer than `agingMs`
// is served before the policy order is consulted.
const { EventEmitter } = require('events');
const FIFOQueue = require('../queues/FIFOQueue');
const CircularQueue = require('../queues/CircularQueue');
const PriorityQueue = require('../queues/PriorityQueue');
const HeapQueue = require('../queues/HeapQueue');
const { evaluate } = require('./RuleEngine');
const { RULE_SET_VERSION } = require('../rules/ruleSet');

const POLICIES = ['FIFO', 'CIRCULAR', 'PRIORITY', 'HEAP'];

function makeQueue(policy) {
  switch (policy) {
    case 'CIRCULAR': return new CircularQueue(50000);
    case 'PRIORITY': return new PriorityQueue((a, b) => (a.priority - b.priority) || (a.seq - b.seq));
    case 'HEAP': return new HeapQueue();
    default: return new FIFOQueue();
  }
}

class Scheduler extends EventEmitter {
  constructor({ metrics, locks, policy = 'PRIORITY', agingMs = 2000 }) {
    super();
    this.metrics = metrics;
    this.locks = locks;
    this.policy = POLICIES.includes(policy) ? policy : 'PRIORITY';
    this.agingMs = agingMs;
    this.requests = new Map();      // request_id -> record
    this.decisions = new Map();     // decision_id -> decision
    this.queues = new Map();        // drive_id -> queue
    this.pending = new Map();       // drive_id -> Map(request_id -> record) (insertion order = arrival order)
    this.seq = 0;
    this.draining = false;
    this.starvationBoosts = 0;
    this.doneSeq = 0;
    this.rrCursor = 0;
    this.recent = [];               // last completed requests for the dashboard
  }

  setPolicy(policy) {
    if (!POLICIES.includes(policy)) throw new Error(`Unsupported policy '${policy}'`);
    this.policy = policy;
    // Re-build queues preserving pending items so the policy switch is lossless
    for (const [driveId, map] of this.pending.entries()) {
      const q = makeQueue(policy);
      for (const r of map.values()) q.enqueue(this._item(r));
      this.queues.set(driveId, q);
    }
  }

  _item(r) {
    return { request_id: r.request_id, priority: this.policy === 'HEAP' ? -r.priority : r.priority, seq: r.seq };
  }

  depth(driveId) {
    if (driveId) return (this.pending.get(driveId) || new Map()).size;
    let n = 0;
    for (const m of this.pending.values()) n += m.size;
    return n;
  }

  /**
   * Enqueue a request. Idempotent by request_id: duplicate submissions return the existing record.
   * @returns {{record, promise}} promise resolves when the request has been evaluated.
   */
  submit(input, correlationId) {
    this.metrics.counters.received++;
    const existing = input.request_id && this.requests.get(input.request_id);
    if (existing) {
      this.metrics.counters.duplicates++;
      return { record: existing, promise: existing._promise || Promise.resolve(existing), duplicate: true };
    }

    const request_id = input.request_id || `REQ-${(++this.seq).toString(36)}${Date.now().toString(36)}`;
    const rec = {
      request_id,
      application_id: input.application_id || null,
      student_id: input.student_id || input.student?.student_id || null,
      drive_id: input.drive_id || 'UNASSIGNED',
      priority: Number.isFinite(input.priority) ? input.priority : 5,
      strategy: input.strategy || 'DECISION_TREE',
      rule_set_version: input.rule_set_version || RULE_SET_VERSION,
      submitted_at: input.submitted_at || new Date().toISOString(),
      enqueued_ms: Date.now(),
      state: 'QUEUED',
      accepted_policy: this.policy,
      correlation_id: correlationId || null,
      student: input.student || { student_id: input.student_id },
      criteria: input.criteria || {},
      slot_id: input.slot_id || null,
      seq: ++this.seq,
      decision: null,
      lease: null,
    };

    rec._promise = new Promise(resolve => { rec._resolve = resolve; });
    this.requests.set(request_id, rec);

    if (!this.queues.has(rec.drive_id)) this.queues.set(rec.drive_id, makeQueue(this.policy));
    if (!this.pending.has(rec.drive_id)) this.pending.set(rec.drive_id, new Map());
    this.queues.get(rec.drive_id).enqueue(this._item(rec));
    this.pending.get(rec.drive_id).set(request_id, rec);

    rec.queue_position = this.depth(rec.drive_id);
    rec.estimated_evaluation_time_ms = Math.max(1, Math.round(rec.queue_position * this._avgEvalMs()));
    this._emitState(rec);
    this._kick();
    return { record: rec, promise: rec._promise, duplicate: false };
  }

  _avgEvalMs() {
    const arr = this.metrics.evalMicros;
    if (!arr.length) return 1;
    return Math.max(0.05, arr.reduce((a, b) => a + b, 0) / arr.length / 1000);
  }

  cancel(requestId) {
    const rec = this.requests.get(requestId);
    if (!rec) return null;
    if (rec.state === 'QUEUED') {
      this.pending.get(rec.drive_id)?.delete(requestId);
      rec.state = 'CANCELLED';
      this.metrics.counters.cancelled++;
      rec._resolve(rec);
      this._emitState(rec);
    }
    return rec;
  }

  _kick() {
    if (this.draining) return;
    this.draining = true;
    setImmediate(() => this._drain());
  }

  async _drain() {
    try {
      while (this.depth() > 0) {
        const driveIds = [...this.pending.entries()].filter(([, m]) => m.size > 0).map(([id]) => id);
        const driveId = driveIds[this.rrCursor++ % driveIds.length];
        const rec = this._nextFor(driveId);
        if (rec) this._process(rec);
        // yield so concurrent submissions can enqueue and be ordered by the policy
        await new Promise(r => setImmediate(r));
      }
    } finally {
      this.draining = false;
      if (this.depth() > 0) this._kick();
    }
  }

  _nextFor(driveId) {
    const pending = this.pending.get(driveId);
    if (!pending || pending.size === 0) return null;
    const queue = this.queues.get(driveId);

    // Aging: oldest request wins when it has waited too long
    const oldest = pending.values().next().value;
    if (Date.now() - oldest.enqueued_ms > this.agingMs) {
      this.starvationBoosts++;
      pending.delete(oldest.request_id);
      return oldest.state === 'QUEUED' ? oldest : this._nextFor(driveId);
    }

    while (queue && !queue.isEmpty()) {
      const item = queue.dequeue();
      const rec = pending.get(item.request_id);
      if (rec) { pending.delete(item.request_id); return rec; }
      // stale (already served by aging or cancelled) -> skip
    }
    return null;
  }

  _process(rec) {
    if (rec.state !== 'QUEUED') return;
    rec.state = 'EVALUATING';
    rec.started_ms = Date.now();
    this._emitState(rec);

    try {
      const decision = evaluate(rec.student, rec.criteria, rec.strategy);
      decision.request_id = rec.request_id;
      decision.application_id = rec.application_id;
      decision.correlation_id = rec.correlation_id;
      decision.submitted_at = rec.submitted_at;
      decision.completed_at = new Date().toISOString();

      // Optional interview-slot lease granted together with an eligible decision
      if (rec.slot_id && decision.eligibility_result !== 'NOT_ELIGIBLE') {
        const g = this.locks.acquire({ slot_id: rec.slot_id, holder_id: rec.student_id || rec.request_id, mode: 'EXCLUSIVE' });
        // acquire is async by signature but resolves synchronously when wait=false
        Promise.resolve(g).then(res => { rec.lease = res; });
      }

      rec.decision = decision;
      rec.state = 'READY';
      rec.completed_ms = Date.now();
      rec.completion_order = ++this.doneSeq; // strict service order (ms timestamps can tie)
      this.decisions.set(decision.decision_id, decision);
      this.metrics.recordCompleted({
        latencyMs: rec.completed_ms - rec.enqueued_ms,
        waitMs: rec.started_ms - rec.enqueued_ms,
        evalMicros: decision.decision_metrics.evaluation_time_us,
        priority: rec.priority,
        strategy: rec.strategy,
      });
      this.recent.unshift({ request_id: rec.request_id, student_id: rec.student_id, drive_id: rec.drive_id, result: decision.eligibility_result, at: decision.completed_at });
      if (this.recent.length > 50) this.recent.pop();
    } catch (err) {
      rec.state = 'FAILED';
      rec.error = err.message;
      this.metrics.counters.failed++;
    }
    this._emitState(rec);
    rec._resolve(rec);
  }

  _emitState(rec) {
    this.emit('state', {
      type: 'eligibility_state',
      request_id: rec.request_id,
      application_id: rec.application_id,
      student_id: rec.student_id,
      drive_id: rec.drive_id,
      state: rec.state,
      rule_set_version: rec.rule_set_version,
      correlation_id: rec.correlation_id,
      timestamp: new Date().toISOString(),
    });
  }

  publicView(rec) {
    const { _promise, _resolve, student, criteria, seq, enqueued_ms, started_ms, completed_ms, ...rest } = rec; // eslint-disable-line no-unused-vars
    return {
      ...rest,
      wait_ms: started_ms ? started_ms - enqueued_ms : null,
      turnaround_ms: completed_ms ? completed_ms - enqueued_ms : null,
    };
  }

  queueView(driveId) {
    const pending = [...(this.pending.get(driveId) || new Map()).values()];
    const policy = this.policy;
    const ordered = [...pending].sort((a, b) => (policy === 'FIFO' || policy === 'CIRCULAR')
      ? a.seq - b.seq
      : (a.priority - b.priority) || (a.seq - b.seq));
    const avg = this._avgEvalMs();
    const done = [...this.requests.values()].filter(r => r.drive_id === driveId && r.state === 'READY');
    const recentDone = done.slice(-5).reverse();
    return {
      drive_id: driveId,
      queue_policy: policy,
      queue_depth: ordered.length,
      estimated_turnaround_time_ms: Math.round(ordered.length * avg),
      queued_requests: ordered.map((r, i) => ({
        request_id: r.request_id, student_id: r.student_id, priority: r.priority, state: r.state,
        queue_position: i + 1, wait_time_ms: Date.now() - r.enqueued_ms,
        estimated_evaluation_time_ms: Math.round((i + 1) * avg),
      })),
      evaluated_total: done.length,
      recent_decisions: recentDone.map(r => ({
        request_id: r.request_id, student_id: r.student_id, result: r.decision?.eligibility_result, state: r.state,
      })),
    };
  }
}

module.exports = { Scheduler, POLICIES };
