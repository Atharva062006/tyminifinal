/**
 * Client for Team A — OS Eligibility Engine (Port 3001).
 * Features timeout control, safe retries, and fallback to mock adapter if offline.
 */
const { withTimeout } = require('../utils/timeout');
const { retryOperation } = require('../utils/retry');
const mockTeamA = require('../../mocks/mockTeamA');

const TEAM_A_BASE_URL = process.env.TEAM_A_BASE_URL || 'http://localhost:3001';
const MOCK_TEAM_A = process.env.MOCK_TEAM_A === 'true';
const TIMEOUT_MS = parseInt(process.env.TEAM_A_TIMEOUT_MS || '3000', 10);

class TeamAClient {
  constructor(baseUrl = TEAM_A_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async _fetch(url, options = {}, correlationId = 'unknown') {
    const headers = {
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
      ...(options.headers || {})
    };

    const fetchPromise = fetch(url, { ...options, headers });
    const response = await withTimeout(fetchPromise, TIMEOUT_MS, `Team A (${url})`);
    
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.error?.message || `Team A error: ${response.statusText}`);
      err.statusCode = response.status;
      err.code = data.error?.code || 'TEAM_A_ERROR';
      err.details = data.error?.details;
      throw err;
    }
    return data.data !== undefined ? data.data : data;
  }

  /**
   * Evaluates student eligibility against drive criteria.
   */
  async evaluateRules(student, driveCriteria, correlationId) {
    if (MOCK_TEAM_A) {
      return mockTeamA.evaluateRules(student, driveCriteria);
    }

    try {
      return await retryOperation(
        () => this._fetch(`${this.baseUrl}/internal/v1/rules/evaluate`, {
          method: 'POST',
          body: JSON.stringify({ student, criteria: driveCriteria })
        }, correlationId),
        { maxRetries: 1 }
      );
    } catch (err) {
      console.warn(`[Team A Client] Live evaluateRules failed (${err.message}). Using local rule evaluator.`);
      return mockTeamA.evaluateRules(student, driveCriteria);
    }
  }

  /**
   * Create eligibility check request
   */
  async createRequest(payload, correlationId) {
    if (MOCK_TEAM_A) {
      return mockTeamA.createRequest(payload, correlationId);
    }

    try {
      return await this._fetch(`${this.baseUrl}/api/v1/eligibility/requests`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }, correlationId);
    } catch (err) {
      console.warn(`[Team A Client] createRequest failed (${err.message}). Falling back to mock adapter.`);
      return mockTeamA.createRequest(payload, correlationId);
    }
  }

  /**
   * Get queue status for a drive
   */
  async getDriveQueue(driveId, correlationId) {
    if (MOCK_TEAM_A) {
      return mockTeamA.getDriveQueue(driveId);
    }

    try {
      return await retryOperation(
        () => this._fetch(`${this.baseUrl}/api/v1/drives/${driveId}/queue`, { method: 'GET' }, correlationId),
        { maxRetries: 1 }
      );
    } catch (err) {
      return mockTeamA.getDriveQueue(driveId);
    }
  }

  /**
   * Get eligibility telemetry & metrics
   */
  async getMetrics(correlationId) {
    if (MOCK_TEAM_A) {
      return mockTeamA.getMetrics();
    }

    try {
      return await retryOperation(
        () => this._fetch(`${this.baseUrl}/api/v1/metrics/eligibility`, { method: 'GET' }, correlationId),
        { maxRetries: 1 }
      );
    } catch (err) {
      return mockTeamA.getMetrics();
    }
  }

  /**
   * Health ping
   */
  async checkHealth() {
    try {
      const res = await withTimeout(fetch(`${this.baseUrl}/health`), 1500, 'Team A Health');
      const data = await res.json();
      return { status: 'ONLINE', details: data };
    } catch (err) {
      return { status: 'DEGRADED', fallback: true, error: err.message };
    }
  }
}

module.exports = new TeamAClient();
