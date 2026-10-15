// Team A — Eligibility Request Controller
// POST /api/v1/eligibility/requests
// GET  /api/v1/eligibility/requests/:requestId
// GET  /api/v1/eligibility/decisions/:decisionId
// POST /internal/v1/rules/evaluate
const { sendSuccess } = require('../../../../shared/response');
const { ValidationError, NotFoundError } = require('../../../../shared/errors');
const { evaluate, STRATEGIES } = require('../engine/RuleEngine');
const { RULE_SET_VERSION } = require('../rules/ruleSet');

module.exports = (engine) => ({
  createRequest: async (req, res, next) => {
    try {
      const b = req.body || {};
      if (!b.student_id && !(b.student && b.student.student_id)) {
        throw new ValidationError('student_id (or student snapshot) is required');
      }
      if (!b.student) throw new ValidationError('student snapshot is required (Team A is read-only on master data)');
      if (b.rule_set_version && b.rule_set_version !== RULE_SET_VERSION) {
        throw new ValidationError(`Rule set version '${b.rule_set_version}' is not available (current: ${RULE_SET_VERSION})`);
      }
      if (b.strategy && !STRATEGIES.includes(b.strategy)) {
        throw new ValidationError(`Unknown strategy '${b.strategy}'. Use one of ${STRATEGIES.join(', ')}`);
      }
      const { record, promise, duplicate } = engine.scheduler.submit(b, req.correlationId);
      const initialPosition = record.queue_position;
      const done = await promise;
      const view = engine.scheduler.publicView(done);
      view.queue_position = initialPosition;
      view.duplicate = duplicate;
      sendSuccess(res, view, req.correlationId, duplicate ? 200 : 201);
    } catch (err) { next(err); }
  },

  getRequest: async (req, res, next) => {
    try {
      const rec = engine.scheduler.requests.get(req.params.requestId);
      if (!rec) throw new NotFoundError('Eligibility request', req.params.requestId);
      sendSuccess(res, engine.scheduler.publicView(rec), req.correlationId);
    } catch (err) { next(err); }
  },

  cancelRequest: async (req, res, next) => {
    try {
      const rec = engine.scheduler.cancel(req.params.requestId);
      if (!rec) throw new NotFoundError('Eligibility request', req.params.requestId);
      sendSuccess(res, engine.scheduler.publicView(rec), req.correlationId);
    } catch (err) { next(err); }
  },

  getDecision: async (req, res, next) => {
    try {
      const d = engine.scheduler.decisions.get(req.params.decisionId);
      if (!d) throw new NotFoundError('Eligibility decision', req.params.decisionId);
      sendSuccess(res, d, req.correlationId);
    } catch (err) { next(err); }
  },

  evaluateRules: async (req, res, next) => {
    try {
      const { student, criteria, strategy } = req.body || {};
      if (!student) throw new ValidationError('student snapshot is required');
      const decision = evaluate(student, criteria || {}, strategy);
      sendSuccess(res, decision, req.correlationId);
    } catch (err) { next(err); }
  },
});
