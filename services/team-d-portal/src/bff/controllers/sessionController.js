/**
 * Session & Authentication Controller for Team D BFF.
 * Supports Student, Faculty/TPO, and Placement Admin roles.
 */
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { ValidationError, UnauthorizedError } = require('../../../../../shared/errors');
const teamC = require('../services/teamCClient');

// Predefined demo personas for quick switching & testing
const DEMO_PERSONAS = [
  { id: 'STU001', role: 'student', name: 'Aarav Sharma', email: 'aarav@rit.edu', branch: 'CSE', cgpa: 8.9 },
  { id: 'STU002', role: 'student', name: 'Rohan Patil', email: 'rohan@rit.edu', branch: 'CSE', cgpa: 7.4 },
  { id: 'STU003', role: 'student', name: 'Ananya Mehta', email: 'ananya@rit.edu', branch: 'IT', cgpa: 9.1 },
  { id: 'FAC001', role: 'faculty', name: 'Prof. Rajesh Kulkarni (TPO)', email: 'tpo@rit.edu', department: 'Training & Placement' },
  { id: 'ADM001', role: 'admin', name: 'Prof. Suresh Deshmukh (Admin)', email: 'admin@rit.edu', department: 'Administration' }
];

class SessionController {
  /**
   * POST /api/v1/ui/session
   * Authenticate user / persona
   */
  create = async (req, res, next) => {
    try {
      const { role, username, password, user_id } = req.body;
      const correlationId = req.correlationId;

      if (!role) {
        throw new ValidationError('Role is required (student, faculty, admin)');
      }

      const normalizedRole = role.toLowerCase() === 'tpo' ? 'faculty' : role.toLowerCase();
      let user = null;

      if (user_id) {
        user = DEMO_PERSONAS.find(p => p.id === user_id);
      }

      if (!user) {
        user = DEMO_PERSONAS.find(p => p.role === normalizedRole);
      }

      if (!user) {
        user = {
          id: user_id || `${normalizedRole.toUpperCase()}001`,
          role: normalizedRole,
          name: username || `${normalizedRole.toUpperCase()} User`,
          email: `${normalizedRole}@rit.edu`
        };
      }

      // If student, try to fetch actual data from Team C
      if (user.role === 'student') {
        try {
          const studentRecord = await teamC.getStudent(user.id, correlationId);
          if (studentRecord) {
            user = { ...user, ...studentRecord };
          }
        } catch {}
      }

      const token = `${user.role}_${user.id}`;

      sendSuccess(res, {
        token: `Bearer ${token}`,
        user: {
          id: user.id,
          role: user.role,
          name: user.name,
          email: user.email,
          branch: user.branch,
          cgpa: user.cgpa,
          skills: user.skills
        },
        permissions: this._getPermissions(user.role),
        auth_mode: 'development_session'
      }, correlationId);
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /api/v1/ui/session
   * Logout user
   */
  destroy = async (req, res, next) => {
    try {
      sendSuccess(res, { message: 'Session logged out successfully' }, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/ui/me
   * Get current authenticated user profile
   */
  getMe = async (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const correlationId = req.correlationId;
      let profile = DEMO_PERSONAS.find(p => p.id === req.user.id) || {
        id: req.user.id,
        role: req.user.role,
        name: `${req.user.role.toUpperCase()} User`,
        email: `${req.user.id}@rit.edu`
      };

      if (req.user.role === 'student') {
        try {
          const studentRecord = await teamC.getStudent(req.user.id, correlationId);
          if (studentRecord) {
            profile = { ...profile, ...studentRecord };
          }
        } catch {}
      }

      sendSuccess(res, {
        user: profile,
        permissions: this._getPermissions(req.user.role)
      }, correlationId);
    } catch (err) {
      next(err);
    }
  };

  _getPermissions(role) {
    switch (role) {
      case 'admin':
        return ['view_all', 'manage_drives', 'manage_applications', 'view_audit', 'view_analytics', 'view_system'];
      case 'faculty':
      case 'tpo':
        return ['view_all', 'view_shortlist', 'view_analytics', 'view_reports'];
      case 'student':
      default:
        return ['view_drives', 'check_eligibility', 'apply', 'view_my_applications', 'view_my_rankings'];
    }
  }
}

module.exports = new SessionController();
