/**
 * Application Workflow Controller for Team D BFF.
 */
const { v4: uuidv4 } = require('uuid');
const { sendSuccess } = require('../utils/apiResponse');
const { ValidationError, NotFoundError, ForbiddenError } = require('../../../../../shared/errors');
const teamC = require('../services/teamCClient');
const applicationService = require('../services/applicationService');

class ApplicationController {
  /**
   * POST /api/v1/ui/applications
   * Submit student application with idempotency key.
   */
  create = async (req, res, next) => {
    try {
      const { student_id, drive_id, resume_version, consent } = req.body;
      const correlationId = req.correlationId;
      const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotency_key || uuidv4();

      if (!student_id || !drive_id) {
        throw new ValidationError('student_id and drive_id are required');
      }

      if (consent !== true) {
        throw new ValidationError('Student consent is required to submit application');
      }

      // If logged in as student, ensure student can only apply for themselves
      if (req.user && req.user.role === 'student' && req.user.id !== student_id) {
        throw new ForbiddenError('Students may only apply for themselves');
      }

      const created = await teamC.createApplication({
        student_id,
        drive_id,
        resume_version: resume_version || 'v1.0',
        consent
      }, idempotencyKey, correlationId);

      sendSuccess(res, created, correlationId, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/ui/applications
   * List applications with role filters.
   */
  list = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;
      const { drive_id, state } = req.query;
      let student_id = req.query.student_id;

      // Restrict students to their own applications
      if (req.user && req.user.role === 'student') {
        student_id = req.user.id;
      }

      const [apps, drives, companies] = await Promise.all([
        teamC.listApplications({ student_id, drive_id, state }, correlationId),
        teamC.listDrives({}, correlationId).catch(() => []),
        teamC.listCompanies(correlationId).catch(() => [])
      ]);

      const driveMap = new Map(drives.map(d => [d.drive_id, d]));
      const companyMap = new Map(companies.map(c => [c.company_id, c]));

      const enriched = apps.map(app => {
        const drive = driveMap.get(app.drive_id) || {};
        const company = companyMap.get(drive.company_id) || {};
        return {
          ...app,
          drive_title: drive.title || 'Placement Drive',
          company_name: company.name || 'Company',
          package: drive.package,
          drive_state: drive.state
        };
      });

      sendSuccess(res, enriched, correlationId);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/ui/applications/:applicationId
   * Detailed application tracking with timeline & cross-service references.
   */
  get = async (req, res, next) => {
    try {
      const { applicationId } = req.params;
      const correlationId = req.correlationId;

      const details = await applicationService.getApplicationDetails(applicationId, correlationId);
      if (!details) {
        throw new NotFoundError('Application', applicationId);
      }

      // Check role permissions: students can only see their own application
      if (req.user && req.user.role === 'student' && details.application.student_id !== req.user.id) {
        throw new ForbiddenError('You can only view your own application details');
      }

      sendSuccess(res, details, correlationId);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/ui/applications/:applicationId/withdraw
   * Withdraw an application.
   */
  withdraw = async (req, res, next) => {
    try {
      const { applicationId } = req.params;
      const correlationId = req.correlationId;
      const authHeader = req.user?.authHeader || `Bearer ${req.user?.role || 'student'}_${req.user?.id || 'unknown'}`;

      const existing = await teamC.getApplication(applicationId, correlationId);
      if (!existing) {
        throw new NotFoundError('Application', applicationId);
      }

      // Authorization guard
      if (req.user && req.user.role === 'student' && existing.student_id !== req.user.id) {
        throw new ForbiddenError('You can only withdraw your own applications');
      }

      const result = await teamC.withdrawApplication(applicationId, correlationId, authHeader);
      sendSuccess(res, result, correlationId);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/ui/applications/:applicationId/interviews
   * Schedule or update an interview round.
   */
  scheduleInterview = async (req, res, next) => {
    try {
      const { applicationId } = req.params;
      const { round_name, scheduled_at, mode, location_url } = req.body;
      const correlationId = req.correlationId;

      const existing = await teamC.getApplication(applicationId, correlationId);
      if (!existing) {
        throw new NotFoundError('Application', applicationId);
      }

      const interviewRecord = {
        interview_id: `INT-${uuidv4().substring(0, 6).toUpperCase()}`,
        application_id: applicationId,
        round_name: round_name || 'Technical Interview',
        scheduled_at: scheduled_at || new Date(Date.now() + 86400000).toISOString(),
        mode: mode || 'Online',
        location_url: location_url || 'https://meet.jit.si/rit-placement-interview',
        status: 'Scheduled',
        created_at: new Date().toISOString()
      };

      sendSuccess(res, interviewRecord, correlationId, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/ui/applications/:applicationId/offer-decision
   * Student accepts or declines placement offer.
   */
  submitOfferDecision = async (req, res, next) => {
    try {
      const { applicationId } = req.params;
      const { decision } = req.body; // 'ACCEPT' or 'DECLINE'
      const correlationId = req.correlationId;

      const existing = await teamC.getApplication(applicationId, correlationId);
      if (!existing) {
        throw new NotFoundError('Application', applicationId);
      }

      if (req.user && req.user.role === 'student' && existing.student_id !== req.user.id) {
        throw new ForbiddenError('You can only make offer decisions for your own applications');
      }

      const targetState = decision === 'ACCEPT' ? 'OFFER_ACCEPTED' : 'OFFER_DECLINED';
      
      const updated = {
        ...existing,
        state: targetState,
        decision_timestamp: new Date().toISOString()
      };

      sendSuccess(res, updated, correlationId);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/ui/applications/:applicationId/shortlist
   * Faculty/Admin shortlists a candidate for a drive.
   */
  shortlist = async (req, res, next) => {
    try {
      const { applicationId } = req.params;
      const correlationId = req.correlationId;

      if (req.user && req.user.role === 'student') {
        throw new ForbiddenError('Students are not authorized to shortlist candidates');
      }

      const existing = await teamC.getApplication(applicationId, correlationId);
      if (!existing) {
        throw new NotFoundError('Application', applicationId);
      }

      if (['WITHDRAWN', 'EXPIRED', 'NOT_ELIGIBLE'].includes(existing.state)) {
        throw new InvalidTransitionError(existing.state, 'SHORTLISTED');
      }

      const updated = {
        ...existing,
        state: 'SHORTLISTED',
        shortlisted_at: new Date().toISOString()
      };

      sendSuccess(res, updated, correlationId);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/ui/applications/:applicationId/offer
   * Faculty/Admin issues a formal placement offer.
   */
  issueOffer = async (req, res, next) => {
    try {
      const { applicationId } = req.params;
      const { package_ctc, joining_date } = req.body;
      const correlationId = req.correlationId;

      if (req.user && req.user.role === 'student') {
        throw new ForbiddenError('Students are not authorized to issue placement offers');
      }

      const existing = await teamC.getApplication(applicationId, correlationId);
      if (!existing) {
        throw new NotFoundError('Application', applicationId);
      }

      if (['WITHDRAWN', 'EXPIRED', 'NOT_ELIGIBLE'].includes(existing.state)) {
        throw new InvalidTransitionError(existing.state, 'OFFER_ISSUED');
      }

      const offerRecord = {
        offer_id: `OFR-${uuidv4().substring(0, 6).toUpperCase()}`,
        application_id: applicationId,
        student_id: existing.student_id,
        drive_id: existing.drive_id,
        package_ctc: package_ctc || 600000,
        joining_date: joining_date || '2026-07-01',
        state: 'OFFER_ISSUED',
        issued_at: new Date().toISOString()
      };

      sendSuccess(res, offerRecord, correlationId, 201);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new ApplicationController();
