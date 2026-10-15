/**
 * Authentication and Role-Based Authorization Middleware for Team D BFF.
 * Sessions are signed tokens issued by Team C's /auth/login (see shared/token.js).
 * Under NODE_ENV=test (or ALLOW_DEV_TOKENS=true) the legacy "Bearer <role>_<userId>" token is accepted too.
 */
const { UnauthorizedError, ForbiddenError } = require('../../../../../shared/errors');
const tokenLib = require('../../../../../shared/token');

const VALID_ROLES = ['student', 'faculty', 'admin', 'tpo', 'auditor'];

function parse(req) {
  let raw = null;
  const header = req.headers['authorization'];
  if (header) {
    const parts = header.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return { error: 'Invalid Authorization header format. Expected "Bearer <token>"' };
    raw = parts[1];
  } else if (req.query && req.query.token) {
    raw = String(req.query.token); // EventSource cannot send headers
  } else {
    return { missing: true };
  }

  const payload = tokenLib.verify(raw);
  if (!payload) return { error: 'Session is invalid or has expired. Please sign in again.' };

  const rawRole = String(payload.role || '').toLowerCase();
  if (!VALID_ROLES.includes(rawRole)) return { error: `Unknown or invalid user role in token: ${rawRole}` };
  const role = rawRole === 'tpo' ? 'faculty' : rawRole;
  const id = payload.id || payload.student_id || payload.sub || 'USER001';

  return {
    user: {
      role,
      id,
      name: payload.name,
      token: raw,
      authHeader: `Bearer ${raw}`,
      actor: { id, role },
    },
  };
}

function authMiddleware(req, res, next) {
  const r = parse(req);
  if (r.missing) return next(new UnauthorizedError('Authentication required. Please log in.'));
  if (r.error) return next(new UnauthorizedError(r.error));
  req.user = r.user;
  next();
}

/** Optional authentication: extracts the user if provided, but does not block if missing/invalid. */
function optionalAuth(req, res, next) {
  const r = parse(req);
  req.user = r.user || null;
  next();
}

/**
 * Role guard middleware
 * @param {string[]} allowedRoles
 */
function requireRoles(allowedRoles) {
  const normalizedAllowed = allowedRoles.map(r => r.toLowerCase() === 'tpo' ? 'faculty' : r.toLowerCase());
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    if (!normalizedAllowed.includes(req.user.role)) {
      return next(new ForbiddenError(`Insufficient permissions. Requires one of: ${allowedRoles.join(', ')}`));
    }
    next();
  };
}

module.exports = { authMiddleware, optionalAuth, requireRoles };
