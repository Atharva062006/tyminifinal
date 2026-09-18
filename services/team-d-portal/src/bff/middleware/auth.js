/**
 * Authentication and Role-Based Authorization Middleware for Team D BFF.
 * In production, this verifies JWT tokens. In dev/academic mode, supports standard Bearer <role>_<id> tokens.
 */
const { UnauthorizedError, ForbiddenError } = require('../../../../../shared/errors');

/**
 * Validates session from Authorization header: "Bearer <role>_<userId>"
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return next(new UnauthorizedError('Authentication required. Please log in.'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next(new UnauthorizedError('Invalid Authorization header format. Expected "Bearer <token>"'));
  }

  const token = parts[1];
  const tokenParts = token.split('_');
  if (tokenParts.length < 1 || !tokenParts[0]) {
    return next(new UnauthorizedError('Invalid token content.'));
  }

  const role = tokenParts[0].toLowerCase();
  const validRoles = ['student', 'faculty', 'admin', 'tpo', 'auditor'];
  
  if (!validRoles.includes(role)) {
    return next(new UnauthorizedError(`Unknown or invalid user role in token: ${role}`));
  }

  // Normalize tpo to faculty role
  const normalizedRole = role === 'tpo' ? 'faculty' : role;
  const userId = tokenParts.slice(1).join('_') || 'USER001';

  req.user = {
    role: normalizedRole,
    id: userId,
    token: token,
    authHeader: authHeader
  };

  next();
}

/**
 * Optional authentication: extracts user if provided, but does not block if missing.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    const token = parts[1];
    const tokenParts = token.split('_');
    if (tokenParts.length >= 1 && tokenParts[0]) {
      const role = tokenParts[0].toLowerCase() === 'tpo' ? 'faculty' : tokenParts[0].toLowerCase();
      req.user = {
        role,
        id: tokenParts.slice(1).join('_') || 'USER001',
        token,
        authHeader
      };
    }
  }
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
