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

// Controllers
const ApplicationController = require('./src/controllers/applicationController');
const OfferController       = require('./src/controllers/offerController');
const AuditController       = require('./src/controllers/auditController');
const ReportController      = require('./src/controllers/reportController');
const DriveController       = require('./src/controllers/driveController');
const StudentController     = require('./src/controllers/studentController');
const CompanyController     = require('./src/controllers/companyController');
const AnnouncementController= require('./src/controllers/announcementController');

// Routes
const buildRoutes = require('./src/routes');
const sseService  = require('./src/services/sseService');

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(correlationMiddleware);

  // Initialize DB
  const db = new Database();
  await db.initialize();

  // Initialize Services
  const idempotencyService = new IdempotencyService(db);
  const auditService = new AuditService(db);
  const applicationService = new ApplicationService(db, idempotencyService, auditService);
  const offerService = new OfferService(db, auditService);
  const reportService = new ReportService(db);
  const recoveryService = new RecoveryService(db);

  // Initialize Controllers
  const controllers = {
    applicationController: new ApplicationController(applicationService),
    offerController:       new OfferController(offerService),
    auditController:       new AuditController(auditService),
    reportController:      new ReportController(reportService, recoveryService),
    driveController:       new DriveController(db),
    studentController:     new StudentController(db),
    companyController:     new CompanyController(db),
    announcementController:new AnnouncementController(db, sseService)
  };

  // Mount Routes
  app.use('/health', (req, res) => res.json({ service: 'team-c-placement', status: 'ok' }));
  app.use('/api/v1', buildRoutes(controllers, idempotencyService)); // Also mounting /internal here for simplicity

  // Error handling
  app.use(errorHandler);

  const PORT = process.env.PORT || 3003;
  const server = app.listen(PORT, () => {
    console.log(`Team C — Placement Engine running on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Team C] Shutting down gracefully...');
    server.close();
    await db.shutdown();
    sseService.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { app, server, db };
}

// If run directly, start the server
if (require.main === module) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { startServer };
