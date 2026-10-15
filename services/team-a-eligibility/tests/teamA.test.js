const request = require('supertest');
const { buildApp } = require('../server');
const { evaluate, referenceDecision, STRATEGIES } = require('../src/engine/RuleEngine');
const { LockManager, WaitForGraph } = require('../src/engine/LockManager');
const { runAll, syntheticStudents } = require('../src/engine/benchmark');

const criteria = { min_cgpa: 7, max_backlogs: 1, branches: ['CSE', 'IT'], min_attendance: 75, required_skills: ['JavaScript', 'Python'] };
const strong = { student_id: 'S1', cgpa: 8.9, backlogs: 0, branch: 'CSE', attendance: 88, skills: ['Python', 'JavaScript'] };
const weakSkills = { ...strong, student_id: 'S2', skills: ['Java'] };
const failing = { student_id: 'S3', cgpa: 6, backlogs: 3, branch: 'MECH', attendance: 60, skills: [] };

describe('A2 rule chaining strategies', () => {
  test.each(STRATEGIES)('%s classifies ELIGIBLE / CONDITIONAL / NOT_ELIGIBLE', (strategy) => {
    expect(evaluate(strong, criteria, strategy).eligibility_result).toBe('ELIGIBLE');
    expect(evaluate(weakSkills, criteria, strategy).eligibility_result).toBe('CONDITIONAL');
    expect(evaluate(failing, criteria, strategy).eligibility_result).toBe('NOT_ELIGIBLE');
  });

  test('hard-rule strategies match the reference oracle 100% on 1000 synthetic students', () => {
    const students = syntheticStudents(1000);
    for (const strategy of ['DECISION_TREE', 'SEQUENTIAL_AND']) {
      const mismatches = students.filter(s =>
        evaluate(s, criteria, strategy).eligibility_result !== referenceDecision(s, criteria));
      expect(mismatches).toHaveLength(0);
    }
  });

  test('decision carries rule_set_version, failed rules and metrics', () => {
    const d = evaluate(failing, criteria);
    expect(d.rule_set_version).toBeTruthy();
    expect(d.failed_rules.length).toBeGreaterThan(0);
    expect(d.decision_metrics.evaluation_time_us).toBeGreaterThanOrEqual(0);
    expect(d.criteria_breakdown).toHaveLength(5);
  });
});

describe('A3 locks and deadlocks', () => {
  test('exclusive slot is never granted twice under 10,000 concurrent attempts', async () => {
    const lm = new LockManager({ sweepMs: 60000 });
    let granted = 0;
    await Promise.all(Array.from({ length: 10000 }, (_, i) =>
      lm.acquire({ slot_id: 'SLOT-X', holder_id: `H${i}` }).then(r => { if (r.lock_granted) granted++; })));
    expect(granted).toBe(1);
    lm.shutdown();
  });

  test('release makes the slot available again; expired leases are swept', async () => {
    const lm = new LockManager({ sweepMs: 60000 });
    const a = await lm.acquire({ slot_id: 'S', holder_id: 'A', lease_timeout_ms: 1 });
    expect((await lm.acquire({ slot_id: 'S', holder_id: 'B' })).lock_granted).toBe(false);
    await new Promise(r => setTimeout(r, 5));
    lm.sweepExpired();
    expect((await lm.acquire({ slot_id: 'S', holder_id: 'B' })).lock_granted).toBe(true);
    expect(lm.release(a.lease_id)).toBe(false);
    lm.shutdown();
  });

  test('waiter is promoted on release', async () => {
    const lm = new LockManager({ sweepMs: 60000 });
    const a = await lm.acquire({ slot_id: 'S', holder_id: 'A' });
    const pending = lm.acquire({ slot_id: 'S', holder_id: 'B', wait: true, wait_timeout_ms: 1000 });
    lm.release(a.lease_id);
    expect((await pending).lock_granted).toBe(true);
    lm.shutdown();
  });

  test('wait-for deadlock is detected and prevented', async () => {
    const lm = new LockManager({ sweepMs: 60000 });
    await lm.acquire({ slot_id: 'S1', holder_id: 'A' });
    await lm.acquire({ slot_id: 'S2', holder_id: 'B' });
    lm.acquire({ slot_id: 'S2', holder_id: 'A', wait: true, wait_timeout_ms: 300 });
    const res = await lm.acquire({ slot_id: 'S1', holder_id: 'B', wait: true, wait_timeout_ms: 300 });
    expect(res.lock_granted).toBe(false);
    expect(res.deadlock_cycle).toBeTruthy();
    expect(res.prevention_or_recovery_action).toBe('REQUESTER_ABORTED');
    lm.shutdown();
  });

  test('100% of seeded cycles detected', () => {
    for (const edges of [[['A', 'B'], ['B', 'A']], [['A', 'B'], ['B', 'C'], ['C', 'A']]]) {
      expect(WaitForGraph.fromEdgeList(edges).findCycles().length).toBeGreaterThan(0);
    }
    expect(WaitForGraph.fromEdgeList([['A', 'B'], ['B', 'C']]).findCycles()).toHaveLength(0);
  });
});

describe('Team A HTTP API', () => {
  const app = buildApp();
  afterAll(() => app.engine.locks.shutdown());

  test('POST /eligibility/requests is idempotent by request_id and queryable', async () => {
    const body = { request_id: 'REQ-T1', application_id: 'APP1', student_id: 'S1', drive_id: 'D1', student: strong, criteria };
    const first = await request(app).post('/api/v1/eligibility/requests').send(body);
    expect(first.status).toBe(201);
    expect(first.body.data.decision.eligibility_result).toBe('ELIGIBLE');
    const again = await request(app).post('/api/v1/eligibility/requests').send(body);
    expect(again.body.data.duplicate).toBe(true);
    expect(again.body.data.decision.decision_id).toBe(first.body.data.decision.decision_id);
    const got = await request(app).get('/api/v1/eligibility/requests/REQ-T1');
    expect(got.body.data.state).toBe('READY');
    const dec = await request(app).get(`/api/v1/eligibility/decisions/${first.body.data.decision.decision_id}`);
    expect(dec.status).toBe(200);
  });

  test('validation and unknown rule set are rejected', async () => {
    const r1 = await request(app).post('/api/v1/eligibility/requests').send({});
    expect(r1.status).toBe(400);
    const r2 = await request(app).post('/api/v1/eligibility/requests')
      .send({ student_id: 'S1', student: strong, criteria, rule_set_version: '9.9.9' });
    expect(r2.status).toBe(400);
  });

  test('priority policy serves higher-priority requests first', async () => {
    const sched = app.engine.scheduler;
    sched.agingMs = 1e9; // disable starvation aging so a slow CI machine cannot reorder this policy test
    const mk = (id, priority) => sched.submit({ request_id: id, student_id: id, drive_id: 'D-PRIO', priority, student: { ...strong, student_id: id }, criteria });
    const subs = [mk('low1', 9), mk('low2', 9), mk('high1', 1), mk('mid1', 5)];
    const recs = await Promise.all(subs.map(s => s.promise));
    const order = [...recs].sort((a, b) => a.completion_order - b.completion_order).map(r => r.request_id);
    expect(order[0]).toBe('high1');
    expect(order.indexOf('mid1')).toBeLessThan(order.indexOf('low1'));
    expect(order.indexOf('low1')).toBeLessThan(order.indexOf('low2'));
  });

  test('queue, metrics, locks and benchmark endpoints respond', async () => {
    expect((await request(app).get('/api/v1/drives/D1/queue')).body.data.drive_id).toBe('D1');
    const m = await request(app).get('/api/v1/metrics/eligibility');
    expect(m.body.data.metrics.requests.completed).toBeGreaterThan(0);
    const l = await request(app).post('/internal/v1/locks/acquire').send({ slot_id: 'X', holder_id: 'A' });
    expect(l.body.data.lock_granted).toBe(true);
    const l2 = await request(app).post('/internal/v1/locks/acquire').send({ slot_id: 'X', holder_id: 'B' });
    expect(l2.body.data.lock_granted).toBe(false);
    expect((await request(app).delete(`/internal/v1/locks/${l.body.data.lease_id}`)).status).toBe(200);
    const dl = await request(app).post('/internal/v1/deadlocks/analyse').send({ edges: [['A', 'B'], ['B', 'A']] });
    expect(dl.body.data.deadlock_detected).toBe(true);
  });
});

describe('Benchmark KPIs', () => {
  test('p95 decision latency <= 200ms for 1000 queued requests and zero duplicate allocations', async () => {
    const app = buildApp();
    const jobs = syntheticStudents(1000).map(s => request(app).post('/api/v1/eligibility/requests')
      .send({ student_id: s.student_id, drive_id: 'BENCH', student: s, criteria }));
    // fire in chunks to keep the socket count sane
    const out = [];
    for (let i = 0; i < jobs.length; i += 100) out.push(...await Promise.all(jobs.slice(i, i + 100)));
    expect(out.every(r => r.status === 201)).toBe(true);
    const metrics = (await request(app).get('/api/v1/metrics/eligibility')).body.data.metrics;
    expect(metrics.p95_decision_latency_ms).toBeLessThanOrEqual(200);
    const bench = await runAll({ n: 500, attempts: 2000 });
    expect(bench.slot_allocation_safety.duplicate_exclusive_allocations).toBe(0);
    expect(bench.deadlock_detection.detected).toBe(bench.deadlock_detection.seeded_cycles);
    app.engine.locks.shutdown();
  }, 60000);
});
