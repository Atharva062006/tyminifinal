/**
 * Application Workflow Controller for Team D BFF.
 * Every state change is a call to Team C (the only owner of application state) made on behalf of the
 * signed-in user; Team C enforces the state machine, role permissions, seats and slot leases.
 */
const { v4: uuidv4 } = require('uuid');
const { sendSuccess } = require('../utils/apiResponse');
const { ValidationError, NotFoundError, ForbiddenError } = require('../../../../../shared/errors');
const teamC = require('../services/teamCClient');
const applicationService = require('../services/applicationService');

class ApplicationController {
  /** POST /api/v1/ui/applications — idempotent submission (Apply → Evaluate → Rank runs inside Team C). */
  create = async (req, res, next) => {
    try {
      const { student_id, drive_id, resume_version, consent } = req.body;
      const correlationId = req.correlationId;
      const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotency_key || uuidv4();

      if (!student_id || !drive_id) throw new ValidationError('student_id and drive_id are required');
      if (consent !== true) throw new ValidationError('Student consent is required to submit application');
      if (req.user.role === 'student' && req.user.id !== student_id) throw new ForbiddenError('Students may only apply for themselves');

      const created = await teamC.createApplication(
        { student_id, drive_id, resume_version: resume_version || 'v1.0', consent }, idempotencyKey, correlationId, req.user.actor);
      sendSuccess(res, created, correlationId, 201);
    } catch (err) { next(err); }
  };

  /** GET /api/v1/ui/applications — enriched list, students see only their own. */
  list = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;
      const { drive_id, state } = req.query;
      let student_id = req.query.student_id;
      if (req.user.role === 'student') student_id = req.user.id;

      const [apps, drives, companies, students] = await Promise.all([
        teamC.listApplications({ student_id, drive_id, state }, correlationId, req.user.actor),
        teamC.listDrives({}, correlationId),
        teamC.listCompanies(correlationId),
        req.user.role === 'student' ? Promise.resolve([]) : teamC.listStudents(correlationId).catch(() => []),
      ]);

      const driveMap = new Map(drives.map(d => [d.drive_id, d]));
      const companyMap = new Map(companies.map(c => [c.company_id, c]));
      const studentMap = new Map(students.map(s => [s.student_id, s]));

      const enriched = apps.map(app => {
        const drive = driveMap.get(app.drive_id) || {};
        const company = companyMap.get(drive.company_id) || {};
        const st = studentMap.get(app.student_id);
        return {
          ...app,
          drive_title: drive.title || 'Placement Drive',
          company_name: company.name || 'Company',
          package: drive.package,
          drive_state: drive.state,
          student_name: st?.name,
          student_branch: st?.branch,
          student_cgpa: st?.cgpa,
        };
      });
      sendSuccess(res, enriched, correlationId);
    } catch (err) { next(err); }
  };

  /** GET /api/v1/ui/applications/:applicationId — details with timeline and cross-service references. */
  get = async (req, res, next) => {
    try {
      const { applicationId } = req.params;
      const details = await applicationService.getApplicationDetails(applicationId, req.correlationId, req.user.actor);
      if (!details) throw new NotFoundError('Application', applicationId);
      if (req.user.role === 'student' && details.application.student_id !== req.user.id) {
        throw new ForbiddenError('You can only view your own application details');
      }
      sendSuccess(res, details, req.correlationId);
    } catch (err) { next(err); }
  };

  _move(target, { status = 200, payloadFrom } = {}) {
    return async (req, res, next) => {
      try {
        const { applicationId } = req.params;
        const body = req.body || {};
        const out = await teamC.transition(applicationId, target, {
          reason: body.reason,
          payload: payloadFrom ? payloadFrom(body) : undefined,
          expectedVersion: body.expected_version,
        }, req.correlationId, req.user.actor);
        sendSuccess(res, out, req.correlationId, status);
      } catch (err) { next(err); }
    };
  }

  withdraw = async (req, res, next) => {
    try {
      sendSuccess(res, await teamC.withdrawApplication(req.params.applicationId, req.correlationId, req.user.actor), req.correlationId);
    } catch (err) { next(err); }
  };

  shortlist = this._move('SHORTLISTED');
  reject = this._move('REJECTED');
  waitlist = this._move('WAITLISTED');
  select = this._move('SELECTED');
  issueOffer = this._move('OFFER_ISSUED', {
    status: 201,
    payloadFrom: (b) => ({ package_ctc: b.package_ctc, joining_date: b.joining_date, role_title: b.role_title }),
  });

  /** POST /api/v1/ui/applications/:id/offer-decision  { decision: 'ACCEPT' | 'DECLINE' } */
  submitOfferDecision = async (req, res, next) => {
    try {
      const decision = String(req.body?.decision || '').toUpperCase();
      if (!['ACCEPT', 'DECLINE'].includes(decision)) throw new ValidationError('decision must be ACCEPT or DECLINE');
      const out = await teamC.transition(req.params.applicationId, decision === 'ACCEPT' ? 'OFFER_ACCEPTED' : 'OFFER_DECLINED', {}, req.correlationId, req.user.actor);
      sendSuccess(res, out, req.correlationId);
    } catch (err) { next(err); }
  };

  /** POST /api/v1/ui/applications/:id/interviews — books a Team A slot lease then records the interview. */
  scheduleInterview = async (req, res, next) => {
    try {
      const out = await teamC.scheduleInterview(req.params.applicationId, req.body || {}, req.correlationId, req.user.actor);
      sendSuccess(res, { ...out.interview, application: { ...out, interview: undefined } }, req.correlationId, 201);
    } catch (err) { next(err); }
  };

  /** POST /api/v1/ui/applications/:id/reevaluate — retry a stalled pipeline / refresh a degraded ranking. */
  reevaluate = async (req, res, next) => {
    try { sendSuccess(res, await teamC.reevaluate(req.params.applicationId, req.correlationId, req.user.actor), req.correlationId); } catch (err) { next(err); }
  };

  /** GET /api/v1/ui/interviews */
  listInterviews = async (req, res, next) => {
    try {
      const filters = { ...req.query };
      if (req.user.role === 'student') filters.student_id = req.user.id;
      const [interviews, drives, companies] = await Promise.all([
        teamC.listInterviews(filters, req.correlationId, req.user.actor),
        teamC.listDrives({}, req.correlationId),
        teamC.listCompanies(req.correlationId),
      ]);
      const dm = new Map(drives.map(d => [d.drive_id, d]));
      const cm = new Map(companies.map(c => [c.company_id, c]));
      sendSuccess(res, interviews.map(i => {
        const d = dm.get(i.drive_id) || {};
        return { ...i, drive_title: d.title, company_name: cm.get(d.company_id)?.name };
      }), req.correlationId);
    } catch (err) { next(err); }
  };

  /** PATCH /api/v1/ui/interviews/:id  { status } */
  updateInterview = async (req, res, next) => {
    try {
      sendSuccess(res, await teamC.updateInterview(req.params.id, String(req.body?.status || '').toUpperCase(), req.correlationId, req.user.actor), req.correlationId);
    } catch (err) { next(err); }
  };

  /** GET /api/v1/ui/offers */
  listOffers = async (req, res, next) => {
    try {
      const filters = { ...req.query };
      if (req.user.role === 'student') filters.student_id = req.user.id;
      const [offers, drives, companies] = await Promise.all([
        teamC.listOffers(filters, req.correlationId, req.user.actor),
        teamC.listDrives({}, req.correlationId),
        teamC.listCompanies(req.correlationId),
      ]);
      const dm = new Map(drives.map(d => [d.drive_id, d]));
      const cm = new Map(companies.map(c => [c.company_id, c]));
      sendSuccess(res, offers.map(o => {
        const d = dm.get(o.drive_id) || {};
        return { ...o, drive_title: d.title, company_name: cm.get(d.company_id)?.name };
      }), req.correlationId);
    } catch (err) { next(err); }
  };
}

module.exports = new ApplicationController();
