const { sendSuccess } = require('../../../../shared/response');

class ReportController {
  constructor(reportService, recoveryService) {
    this.reportService = reportService;
    this.recoveryService = recoveryService;
  }

  // GET /api/v1/reports/placement-performance
  getPlacementPerformance = async (req, res, next) => {
    try {
      sendSuccess(res, await this.reportService.generatePlacementPerformanceReport(req.query), req.correlationId);
    } catch (err) { next(err); }
  };

  // GET /api/v1/reports/reconciliation
  reconcile = async (req, res, next) => {
    try { sendSuccess(res, await this.reportService.reconcile(), req.correlationId); } catch (err) { next(err); }
  };

  // POST /api/v1/internal/recovery/verify
  verifyRecovery = async (req, res, next) => {
    try { sendSuccess(res, await this.recoveryService.verifyRecovery(), req.correlationId); } catch (err) { next(err); }
  };

  // POST /api/v1/internal/recovery/backup
  backup = (req, res, next) => {
    try { sendSuccess(res, this.recoveryService.backup(), req.correlationId, 201); } catch (err) { next(err); }
  };

  // POST /api/v1/internal/recovery/verify-restore
  verifyRestore = (req, res, next) => {
    try {
      sendSuccess(res, { ...this.recoveryService.verifyRestore(req.body?.backup_id), backups: this.recoveryService.listBackups() }, req.correlationId);
    } catch (err) { next(err); }
  };
}

module.exports = ReportController;
