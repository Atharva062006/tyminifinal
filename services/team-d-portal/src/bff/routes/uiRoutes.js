/**
 * Team D BFF UI Router.
 * Mounts all `/api/v1/ui` endpoints with appropriate auth and validation guards.
 */
const express = require('express');
const router = express.Router();

const { authMiddleware, optionalAuth, requireRoles } = require('../middleware/auth');
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

// ── Authentication & Session ────────────────────────────────────────────────
router.post('/session', sessionController.create);
router.delete('/session', sessionController.destroy);
router.get('/me', authMiddleware, sessionController.getMe);

// ── Notifications ───────────────────────────────────────────────────────────
router.get('/notifications', authMiddleware, notificationController.list);
router.patch('/notifications/:id/read', authMiddleware, notificationController.markAsRead);
router.post('/notifications/read-all', authMiddleware, notificationController.markAllAsRead);

// ── Student Profile & Placement Readiness ───────────────────────────────────
router.get('/students/:studentId', authMiddleware, studentBffController.getProfile);
router.patch('/students/:studentId', authMiddleware, studentBffController.updateProfile);
router.get('/students/:studentId/readiness', authMiddleware, studentBffController.getReadiness);

// ── System Announcements ────────────────────────────────────────────────────
router.get('/announcements', optionalAuth, announcementBffController.list);
router.post('/announcements', authMiddleware, requireRoles(['admin', 'faculty']), announcementBffController.create);

// ── Drives & Eligibility ────────────────────────────────────────────────────
router.get('/drives', optionalAuth, driveController.list);
router.get('/companies', optionalAuth, driveController.listCompanies);
router.get('/drives/:driveId', optionalAuth, driveController.get);
router.patch('/drives/:driveId', authMiddleware, requireRoles(['admin', 'faculty']), driveController.update);
router.get('/eligibility/check/:driveId', optionalAuth, driveController.checkEligibility);

// ── Applications ────────────────────────────────────────────────────────────
router.post('/applications', authMiddleware, applicationController.create);
router.get('/applications', authMiddleware, applicationController.list);
router.get('/applications/:applicationId', authMiddleware, applicationController.get);
router.post('/applications/:applicationId/withdraw', authMiddleware, applicationController.withdraw);
router.post('/applications/:applicationId/interviews', authMiddleware, requireRoles(['admin', 'faculty']), applicationController.scheduleInterview);
router.post('/applications/:applicationId/shortlist', authMiddleware, requireRoles(['admin', 'faculty']), applicationController.shortlist);
router.post('/applications/:applicationId/offer', authMiddleware, requireRoles(['admin', 'faculty']), applicationController.issueOffer);
router.post('/applications/:applicationId/offer-decision', authMiddleware, applicationController.submitOfferDecision);

// ── Dashboard & Live Stream ─────────────────────────────────────────────────
router.get('/dashboard', optionalAuth, dashboardController.get);
router.get('/stream', (req, res) => sseProxy.subscribe(req, res));

// ── Rankings & Shortlisting ─────────────────────────────────────────────────
router.get('/rankings', optionalAuth, rankingController.get);
router.post('/rankings/preview', authMiddleware, requireRoles(['admin', 'faculty']), rankingController.preview);

// ── Analytics, Reports & Audit ───────────────────────────────────────────────
router.get('/analytics', authMiddleware, requireRoles(['admin', 'faculty', 'tpo']), reportController.getAnalytics);
router.get('/reports/placement-performance', authMiddleware, requireRoles(['admin', 'faculty', 'tpo']), reportController.getPlacementPerformance);
router.get('/reports/export', authMiddleware, requireRoles(['admin', 'faculty', 'tpo']), reportController.exportReport);
router.get('/audit', authMiddleware, requireRoles(['admin', 'auditor']), reportController.queryAudit);

// ── System Health & Telemetry ───────────────────────────────────────────────
router.get('/system', systemController.getHealth);

module.exports = router;
