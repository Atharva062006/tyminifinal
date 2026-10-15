/**
 * Correlation middleware for Team D.
 * Integrates with shared/correlation.js to ensure X-Correlation-ID is present and forwarded,
 * and opens the request-scoped degraded-mode tracker.
 */
const { correlationMiddleware } = require('../../../../../shared/correlation');
const degraded = require('../utils/degraded');

module.exports = (req, res, next) => correlationMiddleware(req, res, () => degraded.run(next));
