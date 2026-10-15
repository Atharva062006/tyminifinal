/**
 * Administration Controller for Team D BFF: user accounts, engine operations (benchmarks, policies),
 * recovery evidence and reconciliation. All routes are admin-only (auditors may read evidence).
 */
const { sendSuccess } = require('../utils/apiResponse');
const { ValidationError } = require('../../../../../shared/errors');
const teamA = require('../services/teamAClient');
const teamB = require('../services/teamBClient');
const teamC = require('../services/teamCClient');

class AdminController {
  // ── Users ──────────────────────────────────────────────────────────────
  listUsers = async (req, res, next) => {
    try { sendSuccess(res, await teamC.listUsers(req.user.actor, req.correlationId), req.correlationId); } catch (err) { next(err); }
  };
  createUser = async (req, res, next) => {
    try { sendSuccess(res, await teamC.createUser(req.body || {}, req.user.actor, req.correlationId), req.correlationId, 201); } catch (err) { next(err); }
  };
  updateUser = async (req, res, next) => {
    try { sendSuccess(res, await teamC.updateUser(req.params.userId, req.body || {}, req.user.actor, req.correlationId), req.correlationId); } catch (err) { next(err); }
  };

  // ── Engine operations (Team A / Team B evidence) ───────────────────────
  benchmark = async (req, res, next) => {
    try {
      const team = req.params.team;
      const params = req.body || {};
      let out;
      if (team === 'team-a') out = await teamA.runBenchmark(params, req.correlationId);
      else if (team === 'team-b') out = await teamB.runBenchmark(params, req.correlationId);
      else throw new ValidationError("team must be 'team-a' or 'team-b'");
      sendSuccess(res, out, req.correlationId);
    } catch (err) { next(err); }
  };

  getQueuePolicy = async (req, res, next) => {
    try { sendSuccess(res, await teamA.getPolicy(req.correlationId), req.correlationId); } catch (err) { next(err); }
  };
  setQueuePolicy = async (req, res, next) => {
    try { sendSuccess(res, await teamA.setPolicy(req.body?.policy, req.correlationId), req.correlationId); } catch (err) { next(err); }
  };
  listLocks = async (req, res, next) => {
    try { sendSuccess(res, await teamA.listLocks(req.correlationId), req.correlationId); } catch (err) { next(err); }
  };
  analyseDeadlocks = async (req, res, next) => {
    try { sendSuccess(res, await teamA.analyseDeadlocks(req.body?.edges, req.correlationId), req.correlationId); } catch (err) { next(err); }
  };
  skillSuggestions = async (req, res, next) => {
    try { sendSuccess(res, await teamB.skillSuggestions(req.query.prefix, req.correlationId), req.correlationId); } catch (err) { next(err); }
  };
  invalidateRankingCache = async (req, res, next) => {
    try { sendSuccess(res, await teamB.invalidateCache(req.body || {}, req.correlationId), req.correlationId); } catch (err) { next(err); }
  };
  shortlistLookup = async (req, res, next) => {
    try { sendSuccess(res, await teamB.lookupShortlist(req.query.key, req.query.via, req.correlationId), req.correlationId); } catch (err) { next(err); }
  };

  // ── Team C evidence ────────────────────────────────────────────────────
  reconciliation = async (req, res, next) => {
    try { sendSuccess(res, await teamC.reconciliation(req.correlationId, req.user.actor), req.correlationId); } catch (err) { next(err); }
  };
  recoveryVerify = async (req, res, next) => {
    try { sendSuccess(res, await teamC.recoveryVerify(req.correlationId, req.user.actor), req.correlationId); } catch (err) { next(err); }
  };
  recoveryBackup = async (req, res, next) => {
    try { sendSuccess(res, await teamC.recoveryBackup(req.correlationId, req.user.actor), req.correlationId, 201); } catch (err) { next(err); }
  };
  recoveryVerifyRestore = async (req, res, next) => {
    try { sendSuccess(res, await teamC.recoveryVerifyRestore(req.body || {}, req.correlationId, req.user.actor), req.correlationId); } catch (err) { next(err); }
  };
}

module.exports = new AdminController();
