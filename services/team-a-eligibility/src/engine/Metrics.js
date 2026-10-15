// Team A — Runtime telemetry (A4): latency percentiles, throughput, waits by priority.

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

class Metrics {
  constructor(cap = 5000) {
    this.cap = cap;
    this.latencies = [];       // total decision latency (queue wait + evaluation) in ms
    this.evalMicros = [];      // pure rule evaluation time in microseconds
    this.waitByPriority = new Map(); // priority -> number[]
    this.completedAt = [];     // timestamps for throughput
    this.counters = { received: 0, completed: 0, cancelled: 0, duplicates: 0, failed: 0 };
    this.strategyCounts = {};
    this.startedAt = Date.now();
  }

  _push(arr, v) {
    arr.push(v);
    if (arr.length > this.cap) arr.shift();
  }

  recordCompleted({ latencyMs, waitMs, evalMicros, priority, strategy }) {
    this.counters.completed++;
    this._push(this.latencies, latencyMs);
    this._push(this.evalMicros, evalMicros);
    this._push(this.completedAt, Date.now());
    if (!this.waitByPriority.has(priority)) this.waitByPriority.set(priority, []);
    this._push(this.waitByPriority.get(priority), waitMs);
    this.strategyCounts[strategy] = (this.strategyCounts[strategy] || 0) + 1;
  }

  snapshot({ queueDepth, locks, scheduler }) {
    const lat = [...this.latencies].sort((a, b) => a - b);
    const ev = [...this.evalMicros].sort((a, b) => a - b);
    const now = Date.now();
    const lastMinute = this.completedAt.filter(t => now - t < 60000).length;
    const waits = {};
    let maxWait = 0;
    for (const [prio, arr] of this.waitByPriority.entries()) {
      const s = [...arr].sort((a, b) => a - b);
      waits[`priority_${prio}`] = { count: s.length, p95_wait_ms: percentile(s, 95), max_wait_ms: s[s.length - 1] || 0 };
      maxWait = Math.max(maxWait, s[s.length - 1] || 0);
    }
    const uptime = Math.max((now - this.startedAt) / 1000, 1);
    return {
      queue_depth: queueDepth,
      queue_policy: scheduler.policy,
      throughput_per_sec: Number((this.counters.completed / uptime).toFixed(2)),
      throughput_last_minute: lastMinute,
      p50_decision_latency_ms: percentile(lat, 50),
      p95_decision_latency_ms: percentile(lat, 95),
      p99_decision_latency_ms: percentile(lat, 99),
      p95_rule_evaluation_us: percentile(ev, 95),
      avg_turnaround_ms: lat.length ? Number((lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(3)) : 0,
      wait_by_priority: waits,
      max_wait_ms: maxWait,
      starvation_events: scheduler.starvationBoosts,
      active_leases: locks.activeCount(),
      waiting_lock_requests: locks.waitingCount(),
      deadlocks_detected: locks.stats.deadlocks_detected,
      deadlocks_resolved: locks.stats.deadlocks_resolved,
      lock_conflicts: locks.stats.conflicts,
      leases_expired: locks.stats.expired,
      orphan_leases: locks.list().filter(l => new Date(l.expires_at).getTime() < now).length,
      requests: { ...this.counters },
      strategy_usage: { ...this.strategyCounts },
      uptime_seconds: Number(uptime.toFixed(1)),
    };
  }
}

module.exports = { Metrics, percentile };
