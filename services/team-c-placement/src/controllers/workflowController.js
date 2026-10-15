/**
 * Workflow controller — state transitions, interviews, offers and the aggregated application view.
 * All authorisation lives in WorkflowService (role x target state, student ownership).
 */
const { sendSuccess } = require('../../../../shared/response');
const { ForbiddenError, NotFoundError, ValidationError } = require('../../../../shared/errors');
const { teamA } = require('../services/engineClients');

class WorkflowController {
  constructor(workflow, db) {
    this.workflow = workflow;
    this.db = db;
  }

  _actor(req) { return { id: req.user.id, role: req.user.role }; }
  _isStudent(req) { return req.user.role === 'student'; }

  // POST /api/v1/applications/:applicationId/transition
  transition = async (req, res, next) => {
    try {
      const { target_state, reason, payload, expected_version } = req.body || {};
      if (!target_state) throw new ValidationError('target_state is required', [{ field: 'target_state', message: 'Required' }]);
      const out = await this.workflow.transition(req.params.applicationId, String(target_state).toUpperCase(), {
        actor: this._actor(req), reason, payload, expectedVersion: expected_version, correlationId: req.correlationId,
      });
      sendSuccess(res, out, req.correlationId);
    } catch (err) { next(err); }
  };

  // POST /api/v1/applications/:applicationId/interviews
  scheduleInterview = async (req, res, next) => {
    try {
      const out = await this.workflow.scheduleInterview(req.params.applicationId, req.body || {}, {
        actor: this._actor(req), correlationId: req.correlationId, expectedVersion: req.body?.expected_version,
      });
      sendSuccess(res, out, req.correlationId, 201);
    } catch (err) { next(err); }
  };

  // POST /api/v1/applications/:applicationId/reevaluate
  reevaluate = async (req, res, next) => {
    try {
      sendSuccess(res, await this.workflow.reevaluate(req.params.applicationId, { actor: this._actor(req), correlationId: req.correlationId }), req.correlationId);
    } catch (err) { next(err); }
  };

  // GET /api/v1/applications/:applicationId/details
  details = (req, res, next) => {
    try {
      const d = this.workflow.details(req.params.applicationId);
      if (this._isStudent(req) && d.application.student_id !== req.user.id) throw new ForbiddenError('You can only view your own application');
      sendSuccess(res, d, req.correlationId);
    } catch (err) { next(err); }
  };

  // GET /api/v1/interviews
  listInterviews = (req, res, next) => {
    try {
      const { student_id, application_id, drive_id, status } = req.query;
      const sid = this._isStudent(req) ? req.user.id : student_id;
      let rows;
      if (application_id) rows = this.db.lookupBy('interviews', 'application_id', application_id);
      else rows = this.db.table('interviews').all();
      if (sid) rows = rows.filter(r => r.student_id === sid);
      if (drive_id) rows = rows.filter(r => r.drive_id === drive_id);
      if (status) rows = rows.filter(r => r.status === status);
      rows.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
      sendSuccess(res, rows, req.correlationId);
    } catch (err) { next(err); }
  };

  // PATCH /api/v1/interviews/:interviewId  { status: COMPLETED | CANCELLED }
  updateInterview = async (req, res, next) => {
    try {
      if (this._isStudent(req)) throw new ForbiddenError('Only the placement cell can change interviews');
      const iv = this.db.table('interviews').findById(req.params.interviewId);
      if (!iv) throw new NotFoundError('Interview', req.params.interviewId);
      const status = String(req.body?.status || '').toUpperCase();
      if (!['COMPLETED', 'CANCELLED'].includes(status)) throw new ValidationError('status must be COMPLETED or CANCELLED');
      const updated = await this.db.table('interviews').update(iv.interview_id, { status });
      if (iv.lease_id) teamA.releaseLease(iv.lease_id, req.correlationId).catch(() => {});
      await this.workflow.audit.log({ actor: req.user.id, action: `INTERVIEW_${status}`, tableName: 'interviews', recordId: iv.interview_id, before: iv, after: updated, correlationId: req.correlationId });
      sendSuccess(res, updated, req.correlationId);
    } catch (err) { next(err); }
  };

  // GET /api/v1/offers
  listOffers = (req, res, next) => {
    try {
      const { student_id, application_id, drive_id } = req.query;
      const sid = this._isStudent(req) ? req.user.id : student_id;
      let rows = application_id ? this.db.lookupBy('offers', 'application_id', application_id) : this.db.table('offers').all();
      if (sid) rows = rows.filter(r => r.student_id === sid);
      if (drive_id) rows = rows.filter(r => r.drive_id === drive_id);
      rows.sort((a, b) => (b.created_at || b.committed_at || '').localeCompare(a.created_at || a.committed_at || ''));
      sendSuccess(res, rows, req.correlationId);
    } catch (err) { next(err); }
  };

  // POST /api/v1/internal/pipeline/retry
  retryPipeline = async (req, res, next) => {
    try { sendSuccess(res, await this.workflow.retryStalled(req.correlationId), req.correlationId); } catch (err) { next(err); }
  };
}

module.exports = WorkflowController;
