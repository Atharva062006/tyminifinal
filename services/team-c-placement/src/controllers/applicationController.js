const { sendSuccess } = require('../../../../shared/response');
const { ForbiddenError } = require('../../../../shared/errors');

class ApplicationController {
  constructor(applicationService) {
    this.applicationService = applicationService;
  }

  _isStudent(req) { return req.user && req.user.role === 'student'; }

  // POST /api/v1/applications
  create = async (req, res, next) => {
    try {
      const { student_id, drive_id, resume_version, consent, idempotency_key } = req.body;
      if (this._isStudent(req) && req.user.id !== student_id) {
        throw new ForbiddenError('Students may only apply for themselves');
      }
      const app = await this.applicationService.createApplication({
        student_id, drive_id, resume_version, consent,
        idempotency_key: idempotency_key || req.idempotencyKey,
        correlationId: req.correlationId,
        actor: req.user,
      });
      sendSuccess(res, app, req.correlationId, 201);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/applications
  list = (req, res, next) => {
    try {
      const { student_id, drive_id, state } = req.query;
      const scoped = this._isStudent(req) ? req.user.id : student_id;
      sendSuccess(res, this.applicationService.listApplications({ student_id: scoped, drive_id, state }), req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/applications/:applicationId
  get = async (req, res, next) => {
    try {
      const app = this.applicationService.getApplication(req.params.applicationId);
      if (this._isStudent(req) && app.student_id !== req.user.id) throw new ForbiddenError('You can only view your own application');
      sendSuccess(res, app, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v1/applications/:applicationId/withdraw
  withdraw = async (req, res, next) => {
    try {
      const app = await this.applicationService.withdrawApplication(
        req.params.applicationId, { id: req.user.id, role: req.user.role }, req.correlationId);
      sendSuccess(res, app, req.correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ApplicationController;
