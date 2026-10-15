const express = require('express');
const { correlationMiddleware } = require('../../shared/correlation');
const { errorHandler } = require('../../shared/errors');
const { Scheduler } = require('./src/engine/Scheduler');
const { LockManager } = require('./src/engine/LockManager');
const { Metrics } = require('./src/engine/Metrics');

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationMiddleware);

  const metrics = new Metrics();
  const locks = new LockManager();
  const scheduler = new Scheduler({ metrics, locks, policy: process.env.QUEUE_POLICY || 'PRIORITY' });
  const engine = { metrics, locks, scheduler };

  const eligibility = require('./src/controllers/eligibilityController')(engine);
  const queue = require('./src/controllers/queueController')(engine);
  const lock = require('./src/controllers/lockController')(engine);
  const metricsCtl = require('./src/controllers/metricsController')(engine);

  app.get('/health', (req, res) => res.json({
    service: 'team-a-eligibility', status: 'ok', queue_depth: scheduler.depth(), active_leases: locks.activeCount(),
  }));

  // A1 — intake & queues
  app.post('/api/v1/eligibility/requests', eligibility.createRequest);
  app.get('/api/v1/eligibility/requests/:requestId', eligibility.getRequest);
  app.post('/api/v1/eligibility/requests/:requestId/cancel', eligibility.cancelRequest);
  app.get('/api/v1/eligibility/decisions/:decisionId', eligibility.getDecision);
  app.get('/api/v1/drives/:driveId/queue', queue.getDriveQueue);

  // A2 — rule chaining
  app.post('/internal/v1/rules/evaluate', eligibility.evaluateRules);

  // A3 — locks / deadlocks
  app.post('/internal/v1/locks/acquire', lock.acquireLock);
  app.get('/internal/v1/locks', lock.listLocks);
  app.delete('/internal/v1/locks/:leaseId', lock.releaseLock);
  app.post('/internal/v1/deadlocks/analyse', lock.analyseDeadlocks);

  // A4 — telemetry
  app.get('/api/v1/metrics/eligibility', metricsCtl.getMetrics);
  app.get('/api/v1/stream/eligibility', metricsCtl.streamEligibility);
  app.post('/internal/v1/benchmark', metricsCtl.runBenchmark);
  app.get('/internal/v1/policy', metricsCtl.getPolicy);
  app.put('/internal/v1/policy', metricsCtl.setPolicy);

  app.use(errorHandler);
  app.engine = engine;
  return app;
}

const app = buildApp();

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Team A — Eligibility Engine running on port ${PORT}`));
}

module.exports = app;
module.exports.buildApp = buildApp;
