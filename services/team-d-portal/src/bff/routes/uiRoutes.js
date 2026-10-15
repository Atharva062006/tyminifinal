/**
 * Team D BFF UI Router.
 * Mounts all `/api/v1/ui` endpoints with appropriate auth and role guards. The role guards here are the
 * first line of defence; Team C re-checks the acting user role for every state change.
 */
const express = require('express');
const router = express.Router();

const { authMiddleware, optionalAuth, requireRoles } = require('../middleware/auth');
const RateLimiter = require('../middleware/rateLimiter');
const sseProxy = require('../services/sseProxyService');

// Controllers
const sessionController = require('../controllers/sessionController');
const driveController = require('../controllers/driveController');
const applicationController = require('../controllers/applicationController');
const dashboardController = require('../controllers/dashboardController');
const rankingController = require('../controllers/rankingController');
const reportController = require('../controllers/reportController');
const systemController = require('../controllers/systemController');
const studentBffController = require('../controllers/studentBffController');
const announcementBffController = require('../controllers/announcementBffController');
const notificationController = require('../controllers/notificationController');
const adminController = require('../controllers/adminController');

const STAFF = ['admin', 'faculty'];
const authLimiter = new RateLimiter(15 * 60 * 1000, 60).middleware();
const writeLimiter = new RateLimiter(60 * 1000, 120).middleware();
const exportLimiter = new RateLimiter(60 * 1000, 20).middleware();

// ── Authentication & Session (D1) ───────────────────────────────────────────
router.post('/session', authLimiter, sessionController.create);
router.post('/register', authLimiter, sessionController.register);
router.delete('/session', sessionController.destroy);
router.get('/me', authMiddleware, sessionController.getMe);
router.post('/me/password', authMiddleware, authLimiter, sessionController.changePassword);

// ── Notifications ───────────────────────────────────────────────────────────
router.get('/notifications', authMiddleware, notificationController.list);
router.patch('/notifications/:id/read', authMiddleware, notificationController.markAsRead);
router.post('/notifications/read-all', authMiddleware, notificationController.markAllAsRead);

// ── Students: profile, readiness, staff directory ───────────────────────────
router.get('/students', authMiddleware, requireRoles(['admin', 'faculty', 'auditor']), studentBffController.list);
router.post('/students', authMiddleware, requireRoles(STAFF), writeLimiter, studentBffController.create);
router.get('/students/:studentId', authMiddleware, studentBffController.getProfile);
router.patch('/students/:studentId', authMiddleware, writeLimiter, studentBffController.updateProfile);
router.get('/students/:studentId/readiness', authMiddleware, studentBffController.getReadiness);

// ── Announcements ───────────────────────────────────────────────────────────
router.get('/announcements', optionalAuth, announcementBffController.list);
router.post('/announcements', authMiddleware, requireRoles(STAFF), announcementBffController.create);
router.delete('/announcements/:id', authMiddleware, requireRoles(STAFF), announcementBffController.remove);

// ── Companies, Drives & Eligibility (D2) ────────────────────────────────────
router.get('/companies', optionalAuth, driveController.listCompanies);
router.post('/companies', authMiddleware, requireRoles(STAFF), driveController.createCompany);
router.patch('/companies/:companyId', authMiddleware, requireRoles(STAFF), driveController.updateCompany);
router.get('/drives', optionalAuth, driveController.list);
router.post('/drives', authMiddleware, requireRoles(STAFF), writeLimiter, driveController.create);
router.get('/drives/:driveId', optionalAuth, driveController.get);
router.patch('/drives/:driveId', authMiddleware, requireRoles(STAFF), driveController.update);
router.get('/eligibility/check/:driveId', authMiddleware, driveController.checkEligibility);

// ── Applications & workflow ─────────────────────────────────────────────────
router.post('/applications', authMiddleware, requireRoles(['student']), writeLimiter, applicationController.create);
router.get('/applications', authMiddleware, applicationController.list);
router.get('/applications/:applicationId', authMiddleware, applicationController.get);
router.post('/applications/:applicationId/withdraw', authMiddleware, applicationController.withdraw);
router.post('/applications/:applicationId/shortlist', authMiddleware, requireRoles(STAFF), applicationController.shortlist);
router.post('/applications/:applicationId/reject', authMiddleware, requireRoles(STAFF), applicationController.reject);
router.post('/applications/:applicationId/waitlist', authMiddleware, requireRoles(STAFF), applicationController.waitlist);
router.post('/applications/:applicationId/interviews', authMiddleware, requireRoles(STAFF), applicationController.scheduleInterview);
router.post('/applications/:applicationId/select', authMiddleware, requireRoles(STAFF), applicationController.select);
router.post('/applications/:applicationId/offer', authMiddleware, requireRoles(STAFF), applicationController.issueOffer);
router.post('/applications/:applicationId/offer-decision', authMiddleware, requireRoles(['student']), applicationController.submitOfferDecision);
router.post('/applications/:applicationId/reevaluate', authMiddleware, requireRoles(STAFF), applicationController.reevaluate);
router.get('/interviews', authMiddleware, applicationController.listInterviews);
router.patch('/interviews/:id', authMiddleware, requireRoles(STAFF), applicationController.updateInterview);
router.get('/offers', authMiddleware, applicationController.listOffers);

// ── Dashboard & Live Stream (D3) ────────────────────────────────────────────
router.get('/dashboard', authMiddleware, dashboardController.get);
router.get('/stream', optionalAuth, (req, res) => sseProxy.subscribe(req, res));

// ── Rankings & Shortlisting ─────────────────────────────────────────────────
router.get('/rankings', authMiddleware, rankingController.get);
router.post('/rankings/preview', authMiddleware, requireRoles(STAFF), rankingController.preview);

// ── Analytics, Reports & Audit (D4) ─────────────────────────────────────────
router.get('/analytics', authMiddleware, requireRoles(['admin', 'faculty', 'tpo', 'auditor']), reportController.getAnalytics);
router.get('/reports/placement-performance', authMiddleware, requireRoles(['admin', 'faculty', 'tpo', 'auditor']), reportController.getPlacementPerformance);
router.get('/reports/export', authMiddleware, requireRoles(['admin', 'faculty', 'tpo', 'auditor']), exportLimiter, reportController.exportReport);
router.get('/audit', authMiddleware, requireRoles(['admin', 'auditor']), reportController.queryAudit);

// ── Administration ──────────────────────────────────────────────────────────
router.get('/users', authMiddleware, requireRoles(['admin']), adminController.listUsers);
router.post('/users', authMiddleware, requireRoles(['admin']), adminController.createUser);
router.patch('/users/:userId', authMiddleware, requireRoles(['admin']), adminController.updateUser);

// ── System Health, Telemetry & Evidence ─────────────────────────────────────
router.get('/system', systemController.getHealth);
router.post('/system/benchmark/:team', authMiddleware, requireRoles(['admin']), adminController.benchmark);
router.get('/system/team-a/policy', authMiddleware, requireRoles(['admin', 'auditor']), adminController.getQueuePolicy);
router.put('/system/team-a/policy', authMiddleware, requireRoles(['admin']), adminController.setQueuePolicy);
router.get('/system/team-a/locks', authMiddleware, requireRoles(['admin', 'auditor']), adminController.listLocks);
router.post('/system/team-a/deadlocks', authMiddleware, requireRoles(['admin']), adminController.analyseDeadlocks);
router.get('/system/team-b/skills', authMiddleware, adminController.skillSuggestions);
router.get('/system/team-b/shortlist', authMiddleware, requireRoles(['admin', 'faculty', 'auditor']), adminController.shortlistLookup);
router.post('/system/team-b/cache/invalidate', authMiddleware, requireRoles(['admin']), adminController.invalidateRankingCache);
router.get('/system/reconciliation', authMiddleware, requireRoles(['admin', 'auditor']), adminController.reconciliation);
router.post('/system/recovery/verify', authMiddleware, requireRoles(['admin']), adminController.recoveryVerify);
router.post('/system/recovery/backup', authMiddleware, requireRoles(['admin']), adminController.recoveryBackup);
router.post('/system/recovery/verify-restore', authMiddleware, requireRoles(['admin']), adminController.recoveryVerifyRestore);

module.exports = router;
