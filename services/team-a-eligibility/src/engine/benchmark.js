// Team A — Benchmark harness: compares rule-chaining strategies (time, throughput, accuracy vs reference)
// and exercises queue policies / slot-lock safety under concurrency.
const { evaluate, referenceDecision, STRATEGIES } = require('./RuleEngine');
const { LockManager } = require('./LockManager');
const { percentile } = require('./Metrics');

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const BRANCHES = ['CSE', 'IT', 'ENTC', 'MECH', 'CIVIL'];
const SKILLS = ['Python', 'Java', 'SQL', 'JavaScript', 'React', 'C++', 'ML', 'Go'];

function syntheticStudents(n, seed = 42) {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => ({
    student_id: `SYN${i}`,
    cgpa: Number((5 + r() * 5).toFixed(2)),
    backlogs: Math.floor(r() * 4),
    branch: BRANCHES[Math.floor(r() * BRANCHES.length)],
    attendance: Math.floor(60 + r() * 40),
    skills: SKILLS.filter(() => r() > 0.6),
  }));
}

const REFERENCE_CRITERIA = {
  min_cgpa: 7, max_backlogs: 1, branches: ['CSE', 'IT', 'ENTC'], min_attendance: 75, required_skills: ['Python', 'SQL'],
};

function compareStrategies(n = 1000) {
  const students = syntheticStudents(n);
  const out = [];
  for (const strategy of STRATEGIES) {
    const lat = [];
    let agree = 0;
    const t0 = process.hrtime.bigint();
    for (const s of students) {
      const a = process.hrtime.bigint();
      const d = evaluate(s, REFERENCE_CRITERIA, strategy);
      lat.push(Number(process.hrtime.bigint() - a) / 1e6);
      if (d.eligibility_result === referenceDecision(s, REFERENCE_CRITERIA)) agree++;
    }
    const totalMs = Number(process.hrtime.bigint() - t0) / 1e6;
    lat.sort((x, y) => x - y);
    out.push({
      strategy,
      evaluated: n,
      total_ms: Number(totalMs.toFixed(2)),
      throughput_per_sec: Math.round(n / (totalMs / 1000)),
      p95_latency_ms: Number(percentile(lat, 95).toFixed(4)),
      accuracy_vs_reference_pct: Number(((agree / n) * 100).toFixed(2)),
    });
  }
  return out;
}

async function slotSafety(attempts = 10000) {
  const lm = new LockManager({ sweepMs: 60000 });
  const slots = 50;
  const winners = new Map();
  let duplicates = 0;
  const jobs = [];
  for (let i = 0; i < attempts; i++) {
    const slot = `SLOT-${i % slots}`;
    jobs.push(lm.acquire({ slot_id: slot, holder_id: `H${i}`, mode: 'EXCLUSIVE' }).then(res => {
      if (res.lock_granted) {
        if (winners.has(slot)) duplicates++;
        winners.set(slot, res.holder_id);
      }
    }));
  }
  await Promise.all(jobs);
  lm.shutdown();
  return { attempts, slots, granted: winners.size, duplicate_exclusive_allocations: duplicates };
}

function deadlockSeeds() {
  const lm = new LockManager({ sweepMs: 60000 });
  const seeds = [
    [['A', 'B'], ['B', 'A']],
    [['A', 'B'], ['B', 'C'], ['C', 'A']],
    [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'B']],
    [['A', 'B'], ['C', 'D']],
  ];
  const t0 = process.hrtime.bigint();
  const results = seeds.map((edges, i) => {
    const r = lm.analyse(edges);
    return { seed: i + 1, edges: edges.length, expected_cycle: i < 3, detected: r.deadlock_detected };
  });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  lm.shutdown();
  const cyclic = results.filter(r => r.expected_cycle);
  return {
    seeded_cycles: cyclic.length,
    detected: cyclic.filter(r => r.detected).length,
    false_positives: results.filter(r => !r.expected_cycle && r.detected).length,
    total_analysis_ms: Number(ms.toFixed(3)),
    results,
  };
}

async function runAll({ n = 1000, attempts = 10000 } = {}) {
  return {
    generated_at: new Date().toISOString(),
    rule_strategy_comparison: compareStrategies(n),
    slot_allocation_safety: await slotSafety(attempts),
    deadlock_detection: deadlockSeeds(),
  };
}

module.exports = { runAll, compareStrategies, slotSafety, deadlockSeeds, syntheticStudents };
