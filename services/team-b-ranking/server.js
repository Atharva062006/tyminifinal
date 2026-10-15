const express = require('express');
const { correlationMiddleware } = require('../../shared/correlation');
const { errorHandler, ValidationError, NotFoundError } = require('../../shared/errors');
const { sendSuccess } = require('../../shared/response');
const { ProfileRegistry } = require('./src/engine/ProfileRegistry');
const { RankingEngine, ALGORITHMS } = require('./src/engine/RankingEngine');
const { analyse } = require('./src/engine/analytics');
const { runAll } = require('./src/engine/benchmark');

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(correlationMiddleware);

  const registry = new ProfileRegistry();
  const engine = new RankingEngine(registry);
  app.engine = engine;
  app.registry = registry;

  const ok = (req, res, data, status = 200) => sendSuccess(res, data, req.correlationId, status);

  app.get('/health', (req, res) => res.json({
    service: 'team-b-ranking', status: 'ok', graph_version: registry.graphVersion(),
    students: registry.students.size, drives: registry.drives.size,
  }));

  // B1 — profiles & graph
  app.get('/api/v1/profiles', (req, res) => {
    const summary = registry.summary();
    ok(req, res, {
      ...summary,
      students: [...registry.students.values()],
      drives: [...registry.drives.values()],
      change_log: registry.changeLog.slice(-20),
    });
  });

  app.get('/api/v1/profiles/skills', (req, res) => {
    ok(req, res, { prefix: req.query.prefix || '', suggestions: registry.skillTrie.startsWith(String(req.query.prefix || ''), 20) });
  });

  app.put('/internal/v1/profiles/students/:studentId', (req, res, next) => {
    try {
      const r = registry.upsertStudent({ ...req.body, student_id: req.params.studentId });
      if (!r.accepted) throw new ValidationError('Student profile rejected', r.errors);
      if (r.changed) engine.invalidate({});
      ok(req, res, r);
    } catch (e) { next(e); }
  });

  app.put('/internal/v1/profiles/drives/:driveId', (req, res, next) => {
    try {
      const r = registry.upsertDrive({ ...req.body, drive_id: req.params.driveId });
      if (!r.accepted) throw new ValidationError('Drive profile rejected', r.errors);
      if (r.changed) engine.invalidate({ drive_id: req.params.driveId });
      ok(req, res, r);
    } catch (e) { next(e); }
  });

  // Bulk sync used by Team C on start-up
  app.post('/internal/v1/profiles/sync', (req, res) => {
    const accepted = []; const rejected = [];
    for (const s of req.body.students || []) {
      const r = registry.upsertStudent(s);
      (r.accepted ? accepted : rejected).push({ kind: 'student', id: s.student_id, errors: r.errors });
    }
    for (const d of req.body.drives || []) {
      const r = registry.upsertDrive(d);
      (r.accepted ? accepted : rejected).push({ kind: 'drive', id: d.drive_id, errors: r.errors });
    }
    engine.invalidate({});
    ok(req, res, { accepted: accepted.length, rejected, graph_version: registry.graphVersion(), coverage: registry.summary() });
  });

  // B2 — ranking
  app.post('/api/v1/rankings/compute', (req, res, next) => {
    try {
      if (!req.body || !req.body.drive_id) throw new ValidationError('drive_id is required');
      ok(req, res, engine.compute(req.body), 200);
    } catch (e) { engine.errors++; next(e); }
  });

  app.get('/api/v1/rankings/:rankingId', (req, res, next) => {
    try { ok(req, res, engine.getRanking(req.params.rankingId)); } catch (e) { next(e); }
  });

  // B3 — shortlist index & cache
  app.get('/internal/v1/shortlist-index/:key', (req, res, next) => {
    try {
      const out = engine.lookup(req.params.key, req.query.via === 'avl' ? 'avl' : 'hash');
      if (!out.found) throw new NotFoundError('Shortlist entry', req.params.key);
      ok(req, res, out);
    } catch (e) { next(e); }
  });

  app.get('/internal/v1/shortlist-index', (req, res) => ok(req, res, engine.indexStats()));

  app.post('/internal/v1/shortlist-cache/invalidate', (req, res) => {
    ok(req, res, engine.invalidate(req.body || {}));
  });

  // B4 — analytics
  app.post('/api/v1/analytics/analyse', (req, res, next) => {
    try { ok(req, res, analyse(req.body || {})); } catch (e) { next(e); }
  });

  app.get('/api/v1/metrics/ranking', (req, res) => ok(req, res, { service: 'team-b-ranking', timestamp: new Date().toISOString(), metrics: engine.metrics() }));
  app.get('/internal/v1/algorithms', (req, res) => ok(req, res, { algorithms: Object.keys(ALGORITHMS) }));
  app.post('/internal/v1/benchmark', (req, res, next) => {
    try { ok(req, res, runAll(req.body || {})); } catch (e) { next(e); }
  });

  app.use(errorHandler);
  return app;
}

const app = buildApp();

if (require.main === module) {
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => console.log(`Team B — Ranking Engine running on port ${PORT}`));
}

module.exports = app;
module.exports.buildApp = buildApp;
