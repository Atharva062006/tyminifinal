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
      const authHeader = req.user?.authHeader;

      let dashboardData;
      if (role === 'admin') {
        dashboardData = await dashboardService.getAdminDashboard(correlationId, authHeader);
      } else if (role === 'faculty' || role === 'tpo') {
        dashboardData = await dashboardService.getFacultyDashboard(correlationId, authHeader);
      } else {
        const studentId = req.user?.id || req.query.student_id || 'STU001';
        dashboardData = await dashboardService.getStudentDashboard(studentId, correlationId);
      }

      sendSuccess(res, {
        role,
        ...dashboardData
      }, correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new DashboardController();
