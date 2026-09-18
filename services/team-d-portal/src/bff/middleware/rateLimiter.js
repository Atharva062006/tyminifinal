/**
 * In-Memory Rate Limiting Middleware for Team D BFF.
 * Protects auth, application submission, and export endpoints against abuse.
 */
const { AppError } = require('../../../../../shared/errors');

class RateLimiter {
  constructor(windowMs = 15 * 60 * 1000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map();
  }

  middleware() {
    return (req, res, next) => {
      if (process.env.NODE_ENV === 'test') {
        return next(); // Skip in automated unit testing unless specifically testing rate limiter
      }

      const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
      const now = Date.now();

      const record = this.requests.get(ip) || { count: 0, resetTime: now + this.windowMs };

      if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + this.windowMs;
      } else {
        record.count += 1;
      }

      this.requests.set(ip, record);

      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - record.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

      if (record.count > this.maxRequests) {
        return res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please slow down and try again later.',
            details: []
          },
          meta: {
            correlation_id: req.correlationId || 'unknown',
            timestamp: new Date().toISOString()
          }
        });
      }

      next();
    };
  }
}

module.exports = RateLimiter;
