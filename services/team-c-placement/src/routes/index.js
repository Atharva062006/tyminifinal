const express        = require('express');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { validateBody }  = require('../middleware/validation');
const idempotencyMiddleware = require('../middleware/idempotency');
const sseService     = require('../services/sseService');

const STAFF = ['faculty', 'admin'];

module.exports = (controllers, idempotencyService) => {
  const router = express.Router();
  const checkIdempotency = idempotencyMiddleware(idempotencyService);
  const auth = authMiddleware;
  const staff = requireRoles(STAFF);
  const admin = requireRoles(['admin']);

  // ── Accounts / authentication (public: register + login) ────────────────────
  router.post('/auth/register', controllers.authController.register);
  router.post('/auth/login',    controllers.authController.login);
  router.get('/auth/me',        auth, controllers.authController.me);
  router.post('/auth/change-password', auth, controllers.authController.changePassword);

  router.get('/users',          auth, admin, controllers.authController.listUsers);
  router.post('/users',         auth, admin, controllers.authController.createUser);
  router.patch('/users/:userId', auth, admin, controllers.authController.updateUser);

  // ── Companies (C1) ─────────────────────────────────────────────────────────
  router.post('/companies', auth, staff, validateBody({ name: 'string' }), controllers.companyController.create);
  router.get('/companies',  auth, controllers.companyController.list);
  router.get('/companies/:companyId', auth, controllers.companyController.get);
  router.patch('/companies/:companyId', auth, staff, controllers.companyController.update);

  // ── Students (C1) ──────────────────────────────────────────────────────────
  router.get('/students', auth, requireRoles(['faculty', 'admin', 'auditor']), controllers.studentController.list);
  router.get('/students/:studentId', auth, controllers.studentController.get);
  router.post('/students', auth, staff, controllers.studentController.create);
  router.patch('/students/:studentId', auth, controllers.studentController.update);

  // ── Drives (C1) ────────────────────────────────────────────────────────────
  router.post('/drives', auth, staff,
    validateBody({ company_id: 'string', title: 'string', seats: 'number' }),
    controllers.driveController.create
  );
  router.get('/drives',               auth, controllers.driveController.list);
  router.get('/drives/:driveId',      auth, controllers.driveController.get);
  router.get('/drives/:driveId/criteria', auth, controllers.driveController.getCriteria);
  router.patch('/internal/drives/:driveId', auth, staff, controllers.driveController.update);

  // ── Applications (C2) ──────────────────────────────────────────────────────
  router.post('/applications', auth,
    validateBody({ student_id: 'string', drive_id: 'string', consent: 'boolean', idempotency_key: 'string' }),
    checkIdempotency,
    controllers.applicationController.create
  );
  router.get('/applications', auth, controllers.applicationController.list);
  router.get('/applications/:applicationId', auth, controllers.applicationController.get);
  router.get('/applications/:applicationId/details', auth, controllers.workflowController.details);
  router.post('/applications/:applicationId/withdraw', auth, controllers.applicationController.withdraw);
  router.post('/applications/:applicationId/transition', auth, controllers.workflowController.transition);
  router.post('/applications/:applicationId/interviews', auth, staff, controllers.workflowController.scheduleInterview);
  router.post('/applications/:applicationId/reevaluate', auth, staff, controllers.workflowController.reevaluate);

  // ── Interviews & Offers (C2/C3 read models) ────────────────────────────────
  router.get('/interviews', auth, controllers.workflowController.listInterviews);
  router.patch('/interviews/:interviewId', auth, staff, controllers.workflowController.updateInterview);
  router.get('/offers', auth, controllers.workflowController.listOffers);

  // ── Offers / Commit (C3, internal) ─────────────────────────────────────────
  router.post('/internal/offers/commit', auth, staff,
    validateBody({ application_id: 'string', decision_result: 'string', target_state: 'string' }),
    controllers.offerController.commit
  );
  router.post('/internal/offers/compensate', auth, staff,
    validateBody({ application_id: 'string', reason: 'string' }),
    controllers.offerController.compensate
  );
  router.post('/internal/pipeline/retry', auth, staff, controllers.workflowController.retryPipeline);

  // ── Notifications ─────────────────────────────────────────────────────────
  router.get('/notifications', auth, controllers.notificationController.list);
  router.patch('/notifications/:id/read', auth, controllers.notificationController.markRead);
  router.post('/notifications/read-all', auth, controllers.notificationController.markAllRead);

  // ── Audit (C4) ────────────────────────────────────────────────────────────
  router.get('/audit', auth, requireRoles(['admin', 'auditor']), controllers.auditController.query);

  // ── Reports (C4) ──────────────────────────────────────────────────────────
  router.get('/reports/placement-performance', auth, requireRoles(['admin', 'faculty', 'auditor']), controllers.reportController.getPlacementPerformance);
  router.get('/reports/reconciliation', auth, requireRoles(['admin', 'auditor']), controllers.reportController.reconcile);

  // ── Announcements ─────────────────────────────────────────────────────────
  router.get('/announcements', auth, controllers.announcementController.list);
  router.post('/announcements', auth, staff, controllers.announcementController.create);
  router.delete('/announcements/:id', auth, staff, controllers.announcementController.remove);

  // ── Recovery (C4) ─────────────────────────────────────────────────────────
  router.post('/internal/recovery/verify', auth, admin, controllers.reportController.verifyRecovery);
  router.post('/internal/recovery/backup', auth, admin, controllers.reportController.backup);
  router.post('/internal/recovery/verify-restore', auth, admin, controllers.reportController.verifyRestore);

  // ── SSE Stream (C4 outbox) ─────────────────────────────────────────────────
  // GET /api/v1/stream — Team D subscribes here for live state-change events (no user data in payloads).
  router.get('/stream', (req, res) => sseService.subscribe(req, res));

  return router;
};
