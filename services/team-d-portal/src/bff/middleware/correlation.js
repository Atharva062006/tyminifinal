/**
 * Correlation middleware for Team D.
 * Integrates with shared/correlation.js to ensure X-Correlation-ID is present and forwarded.
 */
const { correlationMiddleware } = require('../../../../../shared/correlation');

module.exports = correlationMiddleware;
