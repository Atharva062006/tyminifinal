/**
 * Standard API Response utilities for Team D BFF.
 * Follows APNILEAP common response envelopes.
 */

const { sendSuccess, sendError } = require('../../../../../shared/response');
const { ERROR_CODES } = require('../../../../../shared/constants');

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

module.exports = {
  sendSuccess,
  sendError,
  BFF_ERROR_CODES
};
