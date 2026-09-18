const express        = require('express');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { validateBody }  = require('../middleware/validation');
const idempotencyMiddleware = require('../middleware/idempotency');
const sseService     = require('../services/sseService');

module.exports = (controllers, idempotencyService) => {
  const router = express.Router();

  // Middleware setup
  const checkIdempotency = idempotencyMiddleware(idempotencyService);

  // ── Companies (C1) ─────────────────────────────────────────────────────────
  router.post('/companies',
    validateBody({ name: 'string' }),
    controllers.companyController.create
  );
  router.get('/companies',  controllers.companyController.list);
  router.get('/companies/:companyId', controllers.companyController.get);

  // ── Students (C1) ──────────────────────────────────────────────────────────
  router.get('/students', controllers.studentController.list);
  router.get('/students/:studentId', controllers.studentController.get);
  router.post('/students',
    validateBody({ name: 'string', email: 'string', branch: 'string', cgpa: 'number', backlogs: 'number' }),
    controllers.studentController.create
  );
  router.patch('/students/:studentId', controllers.studentController.update);

  // ── Drives (C1) ────────────────────────────────────────────────────────────
  router.post('/drives',
    validateBody({ company_id: 'string', title: 'string', seats: 'number' }),
    controllers.driveController.create
  );
  router.get('/drives',               controllers.driveController.list);
  router.get('/drives/:driveId',      controllers.driveController.get);
  router.get('/drives/:driveId/criteria', controllers.driveController.getCriteria);
  router.patch('/internal/drives/:driveId', controllers.driveController.update);

  // ── Applications (C2) ──────────────────────────────────────────────────────
  router.post('/applications',
    validateBody({ student_id: 'string', drive_id: 'string', consent: 'boolean', idempotency_key: 'string' }),
    checkIdempotency,
    controllers.applicationController.create
  );
  router.get('/applications',             controllers.applicationController.list);
  router.get('/applications/:applicationId', controllers.applicationController.get);
  router.post('/applications/:applicationId/withdraw',
    authMiddleware,
    controllers.applicationController.withdraw
  );

  // ── Offers / Commit (C3) ───────────────────────────────────────────────────
  router.post('/internal/offers/commit',
    validateBody({ application_id: 'string', decision_result: 'string', target_state: 'string', expected_version: 'number' }),
    controllers.offerController.commit
  );
  router.post('/internal/offers/compensate',
    validateBody({ application_id: 'string', reason: 'string' }),
    controllers.offerController.compensate
  );

  // ── Audit (C4) ────────────────────────────────────────────────────────────
  router.get('/audit',
    authMiddleware,
    requireRoles(['admin', 'auditor']),
    controllers.auditController.query
  );

  // ── Reports (C4) ──────────────────────────────────────────────────────────
  router.get('/reports/placement-performance',
    authMiddleware,
    requireRoles(['admin', 'faculty']),
    controllers.reportController.getPlacementPerformance
  );

  // ── Announcements ─────────────────────────────────────────────────────────
  router.get('/announcements', controllers.announcementController.list);
  router.post('/announcements', controllers.announcementController.create);

  // ── Recovery (C4) ─────────────────────────────────────────────────────────
  router.post('/internal/recovery/verify', controllers.reportController.verifyRecovery);

  // ── SSE Stream (C4 outbox) ─────────────────────────────────────────────────
  // GET /api/v1/stream — Team D subscribes here for live state-change events.
  // No auth guard so Team D dashboard can connect without a session cookie during dev.
  router.get('/stream', (req, res) => sseService.subscribe(req, res));

  return router;
};
