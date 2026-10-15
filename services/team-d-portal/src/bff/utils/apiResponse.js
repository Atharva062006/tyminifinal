/**
 * Standard API Response utilities for Team D BFF.
 * Follows APNILEAP common response envelopes and adds meta.degraded when any engine fell back.
 */

const { sendError } = require('../../../../../shared/response');
const { ERROR_CODES } = require('../../../../../shared/constants');
const degraded = require('./degraded');

// Custom error codes specific to Team D / BFF integration
const BFF_ERROR_CODES = {
  ...ERROR_CODES,
  TEAM_A_UNAVAILABLE: 'TEAM_A_UNAVAILABLE',
  TEAM_B_UNAVAILABLE: 'TEAM_B_UNAVAILABLE',
  TEAM_C_UNAVAILABLE: 'TEAM_C_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  RANKING_DEGRADED: 'RANKING_DEGRADED',
  STALE_DATA: 'STALE_DATA',
  NO_SEATS: 'NO_SEATS',
  DUPLICATE_REQUEST: 'DUPLICATE_REQUEST'
};

function sendSuccess(res, data, correlationId, statusCode = 200) {
  const meta = {
    correlation_id: correlationId,
    api_version: 'v1',
    timestamp: new Date().toISOString(),
  };
  const d = degraded.current();
  if (d) meta.degraded = d;
  return res.status(statusCode).json({ data, meta });
}

module.exports = {
  sendSuccess,
  sendError,
  BFF_ERROR_CODES
};
