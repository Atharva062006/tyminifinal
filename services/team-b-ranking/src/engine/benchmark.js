// Team B — Benchmark harness: ranking latency/optimality, AVL vs hash lookup, list vs matrix graph, cache hit rate.
const { ProfileRegistry } = require('./ProfileRegistry');
const { RankingEngine, percentile } = require('./RankingEngine');

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const SKILLS = ['Python', 'Java', 'SQL', 'JavaScript', 'React', 'C++', 'ML', 'Go', 'Rust', 'Docker', 'Kubernetes', 'AWS', 'Node.js', 'DSA', 'TensorFlow'];
const BRANCHES = ['CSE', 'IT', 'ENTC', 'MECH'];

function buildPool(registry, students = 1000, edgesTarget = 5000, seed = 7) {
  const r = rng(seed);
  const perStudent = Math.max(1, Math.round(edgesTarget / students));
  const pool = [];
  for (let i = 0; i < students; i++) {
    const skills = [];
    for (let k = 0; k < perStudent; k++) skills.push({ name: SKILLS[Math.floor(r() * SKILLS.length)], level: Number((0.3 + r() * 0.7).toFixed(2)) });
    const profile = {
      student_id: `STU${String(i).padStart(5, '0')}`, name: `Student ${i}`, branch: BRANCHES[i % BRANCHES.length],
      cgpa: Number((5.5 + r() * 4.5).toFixed(2)), backlogs: Math.floor(r() * 3), attendance: Math.floor(65 + r() * 35),
      skills: skills.filter((s, idx, arr) => arr.findIndex(x => x.name === s.name) === idx),
    };
    registry.upsertStudent(profile);
    pool.push(profile.student_id);
  }
  registry.upsertDrive({ drive_id: 'BENCH', title: 'Benchmark Drive', min_cutoff: 6, required_skills: [{ name: 'Python', weight: 3 }, { name: 'SQL', weight: 2 }, { name: 'Java', weight: 1 }] });
  return pool;
}

function rankingBenchmark({ students = 1000, edges = 5000, runs = 30 } = {}) {
  const registry = new ProfileRegistry();
  const engine = new RankingEngine(registry);
  const pool = buildPool(registry, students, edges);
  const out = [];
  const orders = {};
  for (const algorithm of ['WEIGHTED_SCORE', 'HEAP_TOPK', 'MERGE_SORT']) {
    const lat = [];
    let res;
    for (let i = 0; i < runs; i++) {
      const t0 = process.hrtime.bigint();
      res = engine.compute({ drive_id: 'BENCH', candidate_ids: pool, algorithm }, { bypassCache: true });
      lat.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    lat.sort((a, b) => a - b);
    orders[algorithm] = res.ordered_candidates.map(c => `${c.student_id}:${c.total_score}`).join(',');
    out.push({ algorithm, candidates: students, p50_ms: Number(percentile(lat, 50).toFixed(3)), p95_ms: Number(percentile(lat, 95).toFixed(3)), ranked: res.ordered_candidates.length });
  }
  const ref = orders.WEIGHTED_SCORE;
  return {
    graph: registry.summary(),
    algorithms: out,
    score_deviation_from_reference: Object.fromEntries(Object.entries(orders).map(([a, o]) => [a, o === ref ? 0 : 1])),
  };
}

function lookupBenchmark({ students = 1000, lookups = 20000 } = {}) {
  const registry = new ProfileRegistry();
  const engine = new RankingEngine(registry);
  const pool = buildPool(registry, students, students * 5);
  engine.compute({ drive_id: 'BENCH', candidate_ids: pool, algorithm: 'MERGE_SORT' });
  const keys = pool.map(id => `BENCH:${id}`);
  const result = {};
  for (const via of ['avl', 'hash']) {
    const lat = [];
    for (let i = 0; i < lookups; i++) lat.push(engine.lookup(keys[i % keys.length], via).lookup_time_us);
    lat.sort((a, b) => a - b);
    result[via] = { lookups, p95_us: Number(percentile(lat, 95).toFixed(3)), p95_ms: Number((percentile(lat, 95) / 1000).toFixed(5)) };
  }
  result.memory = { avl_bytes: engine.avl.memoryBytes(), hash_bytes: engine.hash.memoryBytes(), avl_height: engine.avl.height() };
  return result;
}

function graphComparison({ students = 400, skills = 15 } = {}) {
  const out = {};
  for (const impl of ['LIST', 'MATRIX']) {
    const reg = new ProfileRegistry({ graphImpl: impl });
    const t0 = process.hrtime.bigint();
    buildPool(reg, students, students * 5);
    const buildMs = Number(process.hrtime.bigint() - t0) / 1e6;
    const t1 = process.hrtime.bigint();
    let acc = 0;
    for (let i = 0; i < students; i++) for (const s of SKILLS.slice(0, skills)) acc += reg.graph.getWeight(`S:STU${String(i).padStart(5, '0')}`, `K:${s.toLowerCase()}`);
    const lookupMs = Number(process.hrtime.bigint() - t1) / 1e6;
    out[impl] = { build_ms: Number(buildMs.toFixed(2)), edge_lookup_total_ms: Number(lookupMs.toFixed(2)), memory_bytes_estimate: reg.graph.memoryBytes(), checksum: Number(acc.toFixed(2)) };
  }
  out.checksums_match = out.LIST.checksum === out.MATRIX.checksum;
  return out;
}

function cacheBenchmark({ students = 500, repeats = 50 } = {}) {
  const registry = new ProfileRegistry();
  const engine = new RankingEngine(registry);
  const pool = buildPool(registry, students, students * 5);
  for (let i = 0; i < repeats; i++) engine.compute({ drive_id: 'BENCH', candidate_ids: pool, algorithm: 'HEAP_TOPK', k: 20 });
  const stats = engine.cache.stats();
  const inv = engine.invalidate({ drive_id: 'BENCH' });
  return { repeated_rankings: repeats, hit_rate_pct: stats.hit_rate_pct, invalidation_ms: Number(inv.took_ms.toFixed(3)), invalidated_entries: inv.invalidated };
}

function runAll(opts = {}) {
  return {
    generated_at: new Date().toISOString(),
    ranking: rankingBenchmark(opts),
    index_lookup: lookupBenchmark(opts),
    graph_list_vs_matrix: graphComparison(),
    cache: cacheBenchmark(),
  };
}

module.exports = { runAll, rankingBenchmark, lookupBenchmark, graphComparison, cacheBenchmark, buildPool };
