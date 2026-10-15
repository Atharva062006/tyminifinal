// Team A — Lock Controller (internal)
// POST   /internal/v1/locks/acquire
// GET    /internal/v1/locks
// DELETE /internal/v1/locks/:leaseId
// POST   /internal/v1/deadlocks/analyse
const { sendSuccess } = require('../../../../shared/response');
const { ValidationError, NotFoundError } = require('../../../../shared/errors');

module.exports = (engine) => ({
  acquireLock: async (req, res, next) => {
    try {
      const { slot_id, holder_id } = req.body || {};
      if (!slot_id || !holder_id) throw new ValidationError('slot_id and holder_id are required');
      const result = await engine.locks.acquire(req.body);
      sendSuccess(res, result, req.correlationId, result.lock_granted ? 201 : 200);
    } catch (err) { next(err); }
  },

  listLocks: (req, res, next) => {
    try {
      sendSuccess(res, { leases: engine.locks.list(), waiting: engine.locks.waitingCount() }, req.correlationId);
    } catch (err) { next(err); }
  },

  releaseLock: async (req, res, next) => {
    try {
      const ok = engine.locks.release(req.params.leaseId);
      if (!ok) throw new NotFoundError('Lease', req.params.leaseId);
      sendSuccess(res, { released: true, lease_id: req.params.leaseId }, req.correlationId);
    } catch (err) { next(err); }
  },

  analyseDeadlocks: async (req, res, next) => {
    try {
      const edges = req.body && (req.body.wait_for_edges || req.body.edges);
      sendSuccess(res, engine.locks.analyse(edges), req.correlationId);
    } catch (err) { next(err); }
  },
});
