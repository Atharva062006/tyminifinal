const request = require('supertest');
const { buildApp } = require('../server');
const AVLTree = require('../src/index/AVLTree');
const HashIndex = require('../src/index/HashIndex');
const Trie = require('../src/index/Trie');
const WeightedScore = require('../src/ranking/WeightedScore');
const HeapTopK = require('../src/ranking/HeapTopK');
const MergeSort = require('../src/ranking/MergeSort');
const { runAll } = require('../src/engine/benchmark');

const drive = { drive_id: 'D1', title: 'SDE', min_cutoff: 7, required_skills: [{ name: 'Python', weight: 2 }, { name: 'SQL', weight: 1 }] };
const pool = [
  { student_id: 'A', name: 'A', branch: 'CSE', cgpa: 9.0, backlogs: 0, attendance: 90, skills: ['Python', 'SQL'] },
  { student_id: 'B', name: 'B', branch: 'CSE', cgpa: 8.0, backlogs: 0, attendance: 80, skills: ['Python'] },
  { student_id: 'C', name: 'C', branch: 'IT', cgpa: 8.0, backlogs: 0, attendance: 80, skills: ['Python'] },
  { student_id: 'D', name: 'D', branch: 'IT', cgpa: 6.0, backlogs: 0, attendance: 80, skills: ['Python', 'SQL'] },
  { student_id: 'E', name: 'E', branch: 'IT', cgpa: 7.5, backlogs: 1, attendance: 70, skills: [] },
];

describe('data structures', () => {
  test('AVL tree stays balanced for sequential inserts and supports delete', () => {
    const t = new AVLTree();
    for (let i = 0; i < 1024; i++) t.insert(String(i).padStart(5, '0'), i);
    expect(t.size).toBe(1024);
    expect(t.height()).toBeLessThanOrEqual(12);
    expect(t.get('00500')).toBe(500);
    expect(t.delete('00500')).toBe(true);
    expect(t.get('00500')).toBeUndefined();
    expect(t.deletePrefix('0001')).toBe(10);
  });

  test('Hash index resizes and handles collisions', () => {
    const h = new HashIndex(4);
    for (let i = 0; i < 1000; i++) h.set(`k${i}`, i);
    expect(h.size).toBe(1000);
    expect(h.get('k777')).toBe(777);
    expect(h.delete('k777')).toBe(true);
    expect(h.get('k777')).toBeUndefined();
  });

  test('Trie prefix lookup', () => {
    const t = new Trie();
    ['Python', 'PyTorch', 'Postgres', 'Java'].forEach(s => t.insert(s));
    expect(t.startsWith('py').map(x => x.skill)).toEqual(['Python', 'PyTorch']);
  });

  test('all three algorithms yield identical orderings including tie-break', () => {
    const scored = Array.from({ length: 300 }, (_, i) => ({ student_id: `S${(i * 37) % 300}`, total_score: ((i * 13) % 17) / 17 }));
    const a = new WeightedScore().rank(scored).map(x => x.student_id);
    const b = new HeapTopK().rank(scored).map(x => x.student_id);
    const c = new MergeSort().rank(scored).map(x => x.student_id);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(new HeapTopK().rank(scored, 10).map(x => x.student_id)).toEqual(a.slice(0, 10));
  });
});

describe('Team B HTTP API', () => {
  const app = buildApp();

  test('compute ranks qualified candidates, disqualifies and reports graph_version', async () => {
    const res = await request(app).post('/api/v1/rankings/compute').send({ drive_id: 'D1', drive, candidates: pool, algorithm: 'MERGE_SORT' });
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.ordered_candidates[0].student_id).toBe('A');
    expect(d.graph_version).toMatch(/^g\d+/);
    expect(d.disqualified.map(x => x.student_id)).toContain('D');
    // B and C tie on score -> student_id ascending
    const ids = d.ordered_candidates.map(c => c.student_id);
    expect(ids.indexOf('B')).toBeLessThan(ids.indexOf('C'));
    const got = await request(app).get(`/api/v1/rankings/${d.ranking_id}`);
    expect(got.body.data.stale).toBe(false);
  });

  test('every algorithm returns the same order', async () => {
    const orders = [];
    for (const algorithm of ['WEIGHTED_SCORE', 'HEAP_TOPK', 'MERGE_SORT']) {
      const r = await request(app).post('/api/v1/rankings/compute').send({ drive_id: 'D1', algorithm });
      orders.push(r.body.data.ordered_candidates.map(c => c.student_id).join(','));
    }
    expect(new Set(orders).size).toBe(1);
  });

  test('invalid weight vectors are rejected', async () => {
    const r = await request(app).post('/api/v1/rankings/compute').send({ drive_id: 'D1', weights: { cgpa: 0.9, skills: 0.9, attendance: 0.9 } });
    expect(r.status).toBe(400);
    const r2 = await request(app).post('/api/v1/rankings/compute').send({ drive_id: 'D1', weights: { cgpa: -1, skills: 1, attendance: 1 } });
    expect(r2.status).toBe(400);
  });

  test('no-candidate pool returns documented empty result and unknown drive 404s', async () => {
    const r = await request(app).post('/api/v1/rankings/compute').send({ drive_id: 'D1', candidate_ids: ['NOPE'] });
    expect(r.body.data.no_candidate_result).toBe(true);
    const nf = await request(app).post('/api/v1/rankings/compute').send({ drive_id: 'GHOST' });
    expect(nf.status).toBe(404);
  });

  test('stale graph_version is rejected and profile change marks old ranking stale', async () => {
    const first = await request(app).post('/api/v1/rankings/compute').send({ drive_id: 'D1' });
    const v = first.body.data.graph_version;
    await request(app).put('/internal/v1/profiles/students/A').send({ cgpa: 9.5, branch: 'CSE', skills: ['Python'] });
    const stale = await request(app).post('/api/v1/rankings/compute').send({ drive_id: 'D1', graph_version: v });
    expect(stale.status).toBe(409);
    const old = await request(app).get(`/api/v1/rankings/${first.body.data.ranking_id}`);
    expect(old.body.data.stale).toBe(true);
  });

  test('profile validation rejects bad cgpa', async () => {
    const r = await request(app).put('/internal/v1/profiles/students/Z').send({ cgpa: 99 });
    expect(r.status).toBe(400);
  });

  test('shortlist index lookups via AVL and hash agree; invalidate clears them', async () => {
    await request(app).post('/api/v1/rankings/compute').send({ drive_id: 'D1', algorithm: 'HEAP_TOPK' });
    const h = await request(app).get('/internal/v1/shortlist-index/D1:A?via=hash');
    const a = await request(app).get('/internal/v1/shortlist-index/D1:A?via=avl');
    expect(h.body.data.rank).toBe(a.body.data.rank);
    expect(h.body.data.lookup_time_us).toBeGreaterThanOrEqual(0);
    await request(app).post('/internal/v1/shortlist-cache/invalidate').send({ drive_id: 'D1' });
    expect((await request(app).get('/internal/v1/shortlist-index/D1:A')).status).toBe(404);
  });

  test('analytics and metrics endpoints', async () => {
    const res = await request(app).post('/api/v1/analytics/analyse').send({
      students: pool.map(p => ({ ...p })),
      drives: [{ drive_id: 'D1', company_id: 'C1', package: 600000, criteria: { required_skills: ['Python'] } }],
      companies: [{ company_id: 'C1', name: 'Acme' }],
      applications: [{ student_id: 'A', drive_id: 'D1', state: 'OFFER_ISSUED' }, { student_id: 'B', drive_id: 'D1', state: 'REJECTED' }],
      algorithm: 'SORT_AGG',
    });
    expect(res.body.data.department_trend[0].branch).toBe('CSE');
    expect(res.body.data.company_conversion[0].conversion_pct).toBe(50);
    expect(res.body.data.complexity_evidence.time_complexity).toBe('O(n log n)');
    const m = await request(app).get('/api/v1/metrics/ranking');
    expect(m.body.data.metrics.supported_algorithms).toHaveLength(3);
  });
});

describe('Benchmark KPIs', () => {
  test('p95 ranking <= 100ms at 1000 students / 5000 edges, zero deviation, cache >= 80%, lookup <= 1ms', () => {
    const r = runAll({ students: 1000, edges: 5000, lookups: 5000 });
    for (const a of r.ranking.algorithms) expect(a.p95_ms).toBeLessThanOrEqual(100);
    expect(Object.values(r.ranking.score_deviation_from_reference).every(v => v === 0)).toBe(true);
    expect(r.cache.hit_rate_pct).toBeGreaterThanOrEqual(80);
    expect(r.cache.invalidation_ms).toBeLessThan(2000);
    expect(r.index_lookup.avl.p95_ms).toBeLessThanOrEqual(1);
    expect(r.index_lookup.hash.p95_ms).toBeLessThanOrEqual(1);
    expect(r.graph_list_vs_matrix.checksums_match).toBe(true);
  }, 60000);
});
