/**
 * Session & Authentication Controller for Team D BFF.
 * Real accounts live in Team C (`users` table, scrypt-hashed passwords). The BFF exchanges credentials for a
 * signed session token and never stores passwords.
 */
const { sendSuccess } = require('../utils/apiResponse');
const { ValidationError, UnauthorizedError } = require('../../../../../shared/errors');
const teamC = require('../services/teamCClient');

// Legacy persona login — only available in tests / when ALLOW_DEV_TOKENS=true (never in a normal run)
const DEV_PERSONAS = [
  { id: 'STU001', role: 'student', name: 'Aarav Sharma', email: 'aarav@rit.edu', branch: 'CSE', cgpa: 8.9 },
  { id: 'STU002', role: 'student', name: 'Rohan Patil', email: 'rohan@rit.edu', branch: 'CSE', cgpa: 7.4 },
  { id: 'STU003', role: 'student', name: 'Ananya Mehta', email: 'ananya@rit.edu', branch: 'IT', cgpa: 9.1 },
  { id: 'FAC001', role: 'faculty', name: 'Prof. Rajesh Kulkarni (TPO)', email: 'tpo@rit.edu', department: 'Training & Placement' },
  { id: 'ADM001', role: 'admin', name: 'Prof. Suresh Deshmukh (Admin)', email: 'admin@rit.edu', department: 'Administration' },
];

const devTokensAllowed = () => process.env.NODE_ENV === 'test' || process.env.ALLOW_DEV_TOKENS === 'true';

const PERMISSIONS = {
  admin: ['view_all', 'manage_drives', 'manage_companies', 'manage_users', 'manage_applications', 'view_audit', 'view_analytics', 'view_system', 'view_reports'],
  faculty: ['view_all', 'manage_drives', 'manage_applications', 'view_shortlist', 'view_analytics', 'view_reports', 'post_announcements'],
  auditor: ['view_all', 'view_audit', 'view_reports', 'view_system'],
  student: ['view_drives', 'check_eligibility', 'apply', 'view_my_applications', 'view_my_rankings', 'edit_profile'],
};

const publicUser = (u) => ({
  id: u.id || u.student_id || u.user_id, role: u.role, name: u.name, email: u.email,
  branch: u.branch, cgpa: u.cgpa, skills: u.skills, student_id: u.student_id || (u.role === 'student' ? u.id : undefined),
});

class SessionController {
  /** POST /api/v1/ui/session  { username, password }  */
  create = async (req, res, next) => {
    try {
      const { username, password, role, user_id } = req.body || {};
      const correlationId = req.correlationId;

      if (username && password) {
        const out = await teamC.login({ username, password }, correlationId);
        return sendSuccess(res, {
          token: `Bearer ${out.token}`,
          user: publicUser(out.user),
          permissions: this._getPermissions(out.user.role),
          auth_mode: 'account_login',
        }, correlationId);
      }

      if (role && devTokensAllowed()) {
        const normalized = role.toLowerCase() === 'tpo' ? 'faculty' : role.toLowerCase();
        const user = DEV_PERSONAS.find(p => p.id === user_id) || DEV_PERSONAS.find(p => p.role === normalized)
          || { id: user_id || `${normalized.toUpperCase()}001`, role: normalized, name: `${normalized.toUpperCase()} User`, email: `${normalized}@rit.edu` };
        return sendSuccess(res, {
          token: `Bearer ${user.role}_${user.id}`,
          user: publicUser(user),
          permissions: this._getPermissions(user.role),
          auth_mode: 'development_session',
        }, correlationId);
      }

      throw new ValidationError('E-mail and password are required', [
        { field: 'username', message: 'Required' }, { field: 'password', message: 'Required' }]);
    } catch (err) { next(err); }
  };

  /** POST /api/v1/ui/register — student self-registration; signs the student in immediately. */
  register = async (req, res, next) => {
    try {
      const out = await teamC.register(req.body || {}, req.correlationId);
      sendSuccess(res, {
        token: `Bearer ${out.token}`,
        user: publicUser(out.user),
        permissions: this._getPermissions('student'),
        auth_mode: 'account_login',
      }, req.correlationId, 201);
    } catch (err) { next(err); }
  };

  /** DELETE /api/v1/ui/session — tokens are stateless; the client discards its copy. */
  destroy = async (req, res, next) => {
    try { sendSuccess(res, { message: 'Session logged out successfully' }, req.correlationId); } catch (err) { next(err); }
  };

  /** GET /api/v1/ui/me */
  getMe = async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError('Authentication required');
      let profile;
      try {
        profile = await teamC.me(req.user.actor, req.correlationId);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 401) profile = { id: req.user.id, role: req.user.role, name: req.user.name || req.user.id, email: `${req.user.id}@rit.edu` };
        else throw err;
      }
      if (req.user.role === 'student') {
        const student = await teamC.getStudent(req.user.id, req.correlationId).catch(() => null);
        if (student) profile = { ...profile, ...student, role: 'student', id: req.user.id };
      }
      sendSuccess(res, { user: publicUser({ ...profile, role: req.user.role }), permissions: this._getPermissions(req.user.role) }, req.correlationId);
    } catch (err) { next(err); }
  };

  /** POST /api/v1/ui/me/password */
  changePassword = async (req, res, next) => {
    try { sendSuccess(res, await teamC.changePassword(req.body || {}, req.user.actor, req.correlationId), req.correlationId); } catch (err) { next(err); }
  };

  _getPermissions(role) {
    return PERMISSIONS[role === 'tpo' ? 'faculty' : role] || PERMISSIONS.student;
  }
}

module.exports = new SessionController();
