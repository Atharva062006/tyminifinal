/**
 * Centralized Error Handling Middleware for Team D BFF.
 * Maps AppErrors and upstream microservice errors to standard error envelopes.
 */
const { AppError } = require('../../../../../shared/errors');
const { BFF_ERROR_CODES } = require('../utils/apiResponse');

function errorHandler(err, req, res, next) {
  const correlationId = req.correlationId || 'unknown';
  const timestamp = new Date().toISOString();

  // Known AppError instances from shared/errors.js
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || []
      },
      meta: {
        correlation_id: correlationId,
        timestamp
      }
    });
  }

  // Timeout error
  if (err.code === 'TIMEOUT' || err.name === 'TimeoutError') {
    return res.status(504).json({
      error: {
        code: BFF_ERROR_CODES.TIMEOUT,
        message: err.message || 'Upstream service timed out',
        details: []
      },
      meta: {
        correlation_id: correlationId,
        timestamp
      }
    });
  }

  // Fetch connection refused / network error
  if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') {
    const portMatch = (err.message || '').match(/:(\d+)/);
    let target = 'Upstream service';
    if (portMatch) {
      const port = portMatch[1];
      if (port === '3001') target = 'Team A (Eligibility Engine)';
      else if (port === '3002') target = 'Team B (Ranking Engine)';
      else if (port === '3003') target = 'Team C (Placement DBMS)';
    }

    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: `${target} is temporarily unreachable`,
        details: [{ reason: 'Connection refused', address: err.address, port: err.port }]
      },
      meta: {
        correlation_id: correlationId,
        timestamp
      }
    });
  }

  // General unhandled error
  console.error(`[Team D BFF Unhandled Error] [${correlationId}]`, err);
  return res.status(err.status || err.statusCode || 500).json({
    error: {
      code: err.code || BFF_ERROR_CODES.INTERNAL_ERROR,
      message: err.message || 'An unexpected error occurred in Team D BFF',
      details: err.details || []
    },
    meta: {
      correlation_id: correlationId,
      timestamp
    }
  });
}

module.exports = errorHandler;
