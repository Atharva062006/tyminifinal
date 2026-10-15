/**
 * Auth middleware for Team C.
 *
 * Accepts either
 *   1. a signed session token ("Authorization: Bearer <token>") issued by /auth/login, or
 *   2. a trusted service call carrying the shared `X-Internal-Secret` (Team D BFF, test harness) and, optionally,
 *      the acting user via `X-Actor-Id` / `X-Actor-Role` so authorisation and audit still reflect the real person.
 */
const token = require('../../../../shared/token');
const { UnauthorizedError, ForbiddenError } = require('../../../../shared/errors');

const INTERNAL_SECRET = () => process.env.INTERNAL_SERVICE_SECRET || 'rit_placement_internal_secret_key';

function resolveUser(req) {
  const secret = req.headers['x-internal-secret'];
  if (secret && secret === INTERNAL_SECRET()) {
    return {
      id: req.headers['x-actor-id'] || 'system',
      role: String(req.headers['x-actor-role'] || 'system').toLowerCase(),
      name: req.headers['x-actor-name'] ? decodeURIComponent(req.headers['x-actor-name']) : undefined,
      service: true,
    };
  }
  const header = req.headers['authorization'];
  if (!header) return null;
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  const payload = token.verify(parts[1]);
  if (!payload) return null;
  return { id: payload.id || payload.student_id || payload.sub, user_id: payload.sub, role: payload.role, name: payload.name };
}

/** Requires a valid user or trusted service. */
function authMiddleware(req, res, next) {
  const user = resolveUser(req);
  if (!user) return next(new UnauthorizedError('Valid session token required'));
  req.user = user;
  next();
}

/** Attaches the user when present but never rejects. */
function optionalAuth(req, res, next) {
  req.user = resolveUser(req);
  next();
}

/**
 * Role-based authorisation guard.  Trusted service calls (role "system") pass: the BFF has already
 * authorised the human actor and forwards their role for the downstream checks that matter.
 */
function requireRoles(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(new UnauthorizedError('Valid session token required'));
    if (req.user.role === 'system' || allowedRoles.includes(req.user.role)) return next();
    next(new ForbiddenError(`Requires one of roles: ${allowedRoles.join(', ')}`));
  };
}

module.exports = { authMiddleware, optionalAuth, requireRoles, INTERNAL_SECRET };
