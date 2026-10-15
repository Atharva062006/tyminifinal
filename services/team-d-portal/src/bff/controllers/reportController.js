/**
 * Placement Analytics, Reports & Audit Log Controller for Team D BFF.
 */
const { sendSuccess } = require('../utils/apiResponse');
const analyticsService = require('../services/analyticsService');
const teamC = require('../services/teamCClient');
const teamA = require('../services/teamAClient');
const teamB = require('../services/teamBClient');
const { ForbiddenError } = require('../../../../../shared/errors');

class ReportController {
  /**
   * GET /api/v1/ui/analytics
   * Comprehensive placement analytics dashboard data.
   */
  getAnalytics = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;
      const actor = req.user?.actor;

      if (req.user && req.user.role === 'student') {
        throw new ForbiddenError('Students are not authorized to view institutional analytics');
      }

      const analytics = await analyticsService.getComprehensiveAnalytics(req.query, correlationId, actor);
      sendSuccess(res, analytics, correlationId);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/ui/reports/placement-performance
   * Aggregates placement analytics and engine benchmarks.
   */
  getPlacementPerformance = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;
      const actor = req.user?.actor;

      if (req.user && req.user.role === 'student') {
        throw new ForbiddenError('Students are not authorized to view placement performance reports');
      }

      const [report, aMetrics, bMetrics] = await Promise.all([
        teamC.getPlacementPerformance(req.query, correlationId, actor),
        teamA.getMetrics(correlationId).catch(() => ({ metrics: {} })),
        teamB.getMetrics(correlationId).catch(() => ({ metrics: {} }))
      ]);

      sendSuccess(res, {
        report,
        telemetry: {
          team_a_eligibility: aMetrics.metrics || aMetrics,
          team_b_ranking: bMetrics.metrics || bMetrics
        },
        meta_summary: {
          branch_filter: req.query.branch || 'ALL',
          drive_filter: req.query.drive_id || 'ALL'
        }
      }, correlationId);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/ui/reports/export
   * Export placement analytics report as CSV or JSON.
   */
  exportReport = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;
      const actor = req.user?.actor;
      const { type = 'placement_performance', format = 'csv' } = req.query;

      if (req.user && req.user.role === 'student') {
        throw new ForbiddenError('Students are not authorized to export placement reports');
      }

      const analytics = await analyticsService.getComprehensiveAnalytics(req.query, correlationId, actor);

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="rit_${type}_${Date.now()}.json"`);
        return res.send(JSON.stringify(analytics, null, 2));
      }

      // Helper to sanitize CSV cells against formula injection
      const sanitizeCsvCell = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val).trim();
        if (['=', '+', '-', '@'].includes(str.charAt(0))) {
          return `'${str}`;
        }
        return str;
      };

      // Generate CSV
      let csvLines = [];
      if (type === 'branch_performance') {
        csvLines.push('Branch,Total Students,Eligible Students,Applications,Offers,Placed Students,Placement Rate (%)');
        analytics.branch_breakdown.forEach(b => {
          csvLines.push(`${sanitizeCsvCell(b.branch)},${b.total_students},${b.eligible_students},${b.applications},${b.offers},${b.placed},${b.placement_pct}%`);
        });
      } else if (type === 'drive_performance') {
        csvLines.push('Drive ID,Company Name,Role,Package (INR),Applications,Offers Issued,Offers Accepted,Conversion Rate (%)');
        analytics.drive_analytics.forEach(d => {
          csvLines.push(`${sanitizeCsvCell(d.drive_id)},"${sanitizeCsvCell(d.company_name)}","${sanitizeCsvCell(d.role)}",${d.package},${d.applications},${d.offers_issued},${d.offers_accepted},${d.conversion_rate_pct}%`);
        });
      } else {
        csvLines.push('Metric,Value');
        csvLines.push(`Total Students,${analytics.kpis.total_students}`);
        csvLines.push(`Eligible Students,${analytics.kpis.eligible_students}`);
        csvLines.push(`Total Drives,${analytics.kpis.total_drives}`);
        csvLines.push(`Total Applications,${analytics.kpis.total_applications}`);
        csvLines.push(`Offers Issued,${analytics.kpis.offers_issued}`);
        csvLines.push(`Offers Accepted,${analytics.kpis.offers_accepted}`);
        csvLines.push(`Overall Placement Rate,${analytics.kpis.placement_rate_pct}%`);
        csvLines.push(`Highest Package,${sanitizeCsvCell(analytics.packages.highest)}`);
        csvLines.push(`Average Package,${sanitizeCsvCell(analytics.packages.average)}`);
      }

      const csvContent = csvLines.join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="rit_${type}_${Date.now()}.csv"`);
      res.send(csvContent);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/ui/audit
   * Query immutable audit trail from Team C.
   */
  queryAudit = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;
      const actor = req.user?.actor;

      if (req.user && req.user.role === 'student') {
        throw new ForbiddenError('Students are not authorized to access audit logs');
      }

      const auditData = await teamC.queryAudit(req.query, correlationId, actor);
      sendSuccess(res, auditData, correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new ReportController();
