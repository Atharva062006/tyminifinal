const { v4: uuidv4 } = require('uuid');

/**
 * Express middleware: generates or propagates X-Correlation-ID and X-Response-Time-MS telemetry.
 * Attaches correlation_id to req for use in controllers and logs.
 */
function correlationMiddleware(req, res, next) {
  const start = Date.now();
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!res.headersSent) {
      try { res.setHeader('X-Response-Time-MS', `${duration}ms`); } catch (e) {}
    }
  });

  next();
}

module.exports = { correlationMiddleware };
