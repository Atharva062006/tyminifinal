// Team A — Metrics Controller
// GET  /api/v1/metrics/eligibility
// GET  /api/v1/stream/eligibility  (SSE)
// POST /internal/v1/benchmark
// GET/PUT /internal/v1/policy
const { sendSuccess } = require('../../../../shared/response');
const { ValidationError } = require('../../../../shared/errors');
const { POLICIES } = require('../engine/Scheduler');
const { STRATEGIES } = require('../engine/RuleEngine');
const { runAll } = require('../engine/benchmark');

module.exports = (engine) => ({
  getMetrics: (req, res, next) => {
    try {
      const metrics = engine.metrics.snapshot({
        queueDepth: engine.scheduler.depth(),
        locks: engine.locks,
        scheduler: engine.scheduler,
      });
      sendSuccess(res, {
        service: 'team-a-eligibility',
        timestamp: new Date().toISOString(),
        metrics,
        supported: { policies: POLICIES, strategies: STRATEGIES },
        recent_decisions: engine.scheduler.recent.slice(0, 10),
      }, req.correlationId);
    } catch (err) { next(err); }
  },

  streamEligibility: (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`event: connected\ndata: ${JSON.stringify({ service: 'team-a-eligibility', timestamp: new Date().toISOString() })}\n\n`);
    const onState = (evt) => res.write(`event: eligibility_state\ndata: ${JSON.stringify(evt)}\n\n`);
    engine.scheduler.on('state', onState);
    const interval = setInterval(() => res.write(':ping\n\n'), 15000);
    req.on('close', () => { clearInterval(interval); engine.scheduler.off('state', onState); });
  },

  runBenchmark: async (req, res, next) => {
    try {
      const n = Math.min(parseInt(req.body?.n || '1000', 10), 20000);
      const attempts = Math.min(parseInt(req.body?.attempts || '10000', 10), 100000);
      sendSuccess(res, await runAll({ n, attempts }), req.correlationId);
    } catch (err) { next(err); }
  },

  getPolicy: (req, res, next) => {
    try {
      sendSuccess(res, { policy: engine.scheduler.policy, available: POLICIES }, req.correlationId);
    } catch (err) { next(err); }
  },

  setPolicy: (req, res, next) => {
    try {
      const policy = String(req.body?.policy || '').toUpperCase();
      if (!POLICIES.includes(policy)) throw new ValidationError(`policy must be one of ${POLICIES.join(', ')}`);
      engine.scheduler.setPolicy(policy);
      sendSuccess(res, { policy }, req.correlationId);
    } catch (err) { next(err); }
  },
});
