const express = require('express');
const { correlationMiddleware } = require('../../shared/correlation');
const { errorHandler } = require('../../shared/errors');
const Database = require('./src/db/Database');

// Services
const IdempotencyService = require('./src/services/idempotencyService');
const AuditService = require('./src/services/auditService');
const ApplicationService = require('./src/services/applicationService');
const OfferService = require('./src/services/offerService');
const ReportService = require('./src/services/reportService');
const RecoveryService = require('./src/services/recoveryService');
const AuthService = require('./src/services/authService');
const NotificationService = require('./src/services/notificationService');
const WorkflowService = require('./src/services/workflowService');
const { seed } = require('./src/services/seedService');
const { teamB } = require('./src/services/engineClients');

// Controllers
const ApplicationController = require('./src/controllers/applicationController');
const OfferController       = require('./src/controllers/offerController');
const AuditController       = require('./src/controllers/auditController');
const ReportController      = require('./src/controllers/reportController');
const DriveController       = require('./src/controllers/driveController');
const StudentController     = require('./src/controllers/studentController');
const CompanyController     = require('./src/controllers/companyController');
const AnnouncementController= require('./src/controllers/announcementController');
const AuthController        = require('./src/controllers/authController');
const NotificationController= require('./src/controllers/notificationController');
const WorkflowController    = require('./src/controllers/workflowController');

// Routes
const buildRoutes = require('./src/routes');
const sseService  = require('./src/services/sseService');

/** Push every student and drive profile to Team B so rankings work after a restart (best effort). */
async function syncProfilesToTeamB(db, workflow) {
  try {
    const students = db.table('students').all().map(s => workflow.snapshot(s));
    const drives = db.table('drives').all().map(d => {
      let criteria = {};
      try { criteria = d.criteria_json ? JSON.parse(d.criteria_json) : {}; } catch { /* ignore */ }
      return { drive_id: d.drive_id, title: d.title, criteria, seats: d.seats_total || d.seats };
    });
    const r = await teamB.sync({ students, drives });
    console.log(`[Team C] Synced ${r.accepted} profiles to Team B (graph ${r.graph_version})`);
  } catch (err) {
    console.warn(`[Team C] Team B profile sync skipped: ${err.message}`);
  }
}

async function startServer({ dataDir, port, listen = true, autoSeed = process.env.AUTO_SEED !== 'false' } = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationMiddleware);

  // Initialize DB
  const db = dataDir ? new Database(dataDir) : new Database();
  await db.initialize();

  // Initialize Services
  const idempotencyService = new IdempotencyService(db);
  const auditService = new AuditService(db);
  const notificationService = new NotificationService(db);
  const workflow = new WorkflowService(db, auditService, notificationService);
  const authService = new AuthService(db, auditService);
  const applicationService = new ApplicationService(db, idempotencyService, auditService, workflow);
  const offerService = new OfferService(db, auditService, workflow);
  const reportService = new ReportService(db);
  const recoveryService = new RecoveryService(db);

  if (autoSeed) {
    const r = await seed({ db, auditService, authService, notificationService });
    if (r.seeded) console.log(`[Team C] Seeded demo data (${r.students} students, ${r.drives} drives, ${r.applications} applications)`);
  } else {
    await authService.ensureAccounts();
  }

  // Initialize Controllers
  const controllers = {
    applicationController: new ApplicationController(applicationService),
    offerController:       new OfferController(offerService),
    auditController:       new AuditController(auditService),
    reportController:      new ReportController(reportService, recoveryService),
    driveController:       new DriveController(db),
    studentController:     new StudentController(db, authService, workflow),
    companyController:     new CompanyController(db),
    announcementController:new AnnouncementController(db, sseService, notificationService),
    authController:        new AuthController(authService),
    notificationController:new NotificationController(notificationService),
    workflowController:    new WorkflowController(workflow, db),
  };

  // Mount Routes
  app.use('/health', (req, res) => res.json({ service: 'team-c-placement', status: 'ok' }));
  app.use('/api/v1', buildRoutes(controllers, idempotencyService)); // internal routes live under /api/v1/internal

  // Error handling
  app.use(errorHandler);

  let server = null;
  if (listen) {
    const PORT = port || process.env.PORT || 3003;
    server = app.listen(PORT, () => {
      console.log(`Team C — Placement Engine running on port ${PORT}`);
      // Engines may start after Team C: give them a moment, then sync profiles and retry stalled pipelines.
      setTimeout(() => {
        syncProfilesToTeamB(db, workflow)
          .then(() => workflow.retryStalled('startup'))
          .catch(() => {});
      }, 2500).unref();
    });
  }

  const shutdown = async () => {
    console.log('\n[Team C] Shutting down gracefully...');
    if (server) server.close();
    await db.shutdown();
    sseService.shutdown();
    process.exit(0);
  };
  if (listen) {
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  return { app, server, db, workflow, services: { authService, notificationService, auditService, reportService, recoveryService } };
}

// If run directly, start the server
if (require.main === module) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { startServer };
