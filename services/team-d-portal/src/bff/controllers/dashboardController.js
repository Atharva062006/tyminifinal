/**
 * Live Dashboard Controller for Team D BFF.
 */
const { sendSuccess } = require('../utils/apiResponse');
const dashboardService = require('../services/dashboardService');

class DashboardController {
  /**
   * GET /api/v1/ui/dashboard
   * Aggregates role-specific metrics, charts, and pipeline data.
   */
  get = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;
      const role = req.user?.role || 'student';
      const actor = req.user?.actor;

      let dashboardData;
      if (role === 'admin' || role === 'auditor') {
        dashboardData = await dashboardService.getAdminDashboard(correlationId, actor);
      } else if (role === 'faculty' || role === 'tpo') {
        dashboardData = await dashboardService.getFacultyDashboard(correlationId, actor);
      } else {
        const studentId = req.user?.id || req.query.student_id || 'STU001';
        dashboardData = await dashboardService.getStudentDashboard(studentId, correlationId, actor);
      }

      sendSuccess(res, { role, ...dashboardData }, correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new DashboardController();
