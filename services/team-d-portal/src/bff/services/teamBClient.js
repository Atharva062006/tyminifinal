/**
 * Client for Team B — DS Ranking Engine (Port 3002).
 * Features timeout control, safe retries, and fallback to mock adapter if offline.
 */
const { withTimeout } = require('../utils/timeout');
const { retryOperation } = require('../utils/retry');
const mockTeamB = require('../../mocks/mockTeamB');

const TEAM_B_BASE_URL = process.env.TEAM_B_BASE_URL || 'http://localhost:3002';
const MOCK_TEAM_B = process.env.MOCK_TEAM_B === 'true';
const TIMEOUT_MS = parseInt(process.env.TEAM_B_TIMEOUT_MS || '3000', 10);

class TeamBClient {
  constructor(baseUrl = TEAM_B_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async _fetch(url, options = {}, correlationId = 'unknown') {
    const headers = {
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
      ...(options.headers || {})
    };

    const fetchPromise = fetch(url, { ...options, headers });
    const response = await withTimeout(fetchPromise, TIMEOUT_MS, `Team B (${url})`);
    
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.error?.message || `Team B error: ${response.statusText}`);
      err.statusCode = response.status;
      err.code = data.error?.code || 'TEAM_B_ERROR';
      err.details = data.error?.details;
      throw err;
    }
    return data.data !== undefined ? data.data : data;
  }

  /**
   * Computes candidate rankings for a drive.
   */
  async computeRanking(payload, correlationId) {
    if (MOCK_TEAM_B) {
      return mockTeamB.computeRanking(payload);
    }

    try {
      return await this._fetch(`${this.baseUrl}/api/v1/rankings/compute`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }, correlationId);
    } catch (err) {
      console.warn(`[Team B Client] computeRanking failed (${err.message}). Falling back to mock adapter.`);
      const res = await mockTeamB.computeRanking(payload);
      return { ...res, degraded: true };
    }
  }

  /**
   * Get ranking by ID
   */
  async getRanking(rankingId, correlationId) {
    if (MOCK_TEAM_B) {
      return mockTeamB.getRanking(rankingId);
    }

    try {
      return await retryOperation(
        () => this._fetch(`${this.baseUrl}/api/v1/rankings/${rankingId}`, { method: 'GET' }, correlationId),
        { maxRetries: 1 }
      );
    } catch (err) {
      return mockTeamB.getRanking(rankingId);
    }
  }

  /**
   * Get profiles and skill graph summary
   */
  async getProfiles(correlationId) {
    if (MOCK_TEAM_B) {
      return mockTeamB.getProfiles();
    }

    try {
      return await retryOperation(
        () => this._fetch(`${this.baseUrl}/api/v1/profiles`, { method: 'GET' }, correlationId),
        { maxRetries: 1 }
      );
    } catch (err) {
      return mockTeamB.getProfiles();
    }
  }

  /**
   * Cohort & performance analytics
   */
  async analyseCohort(params, correlationId) {
    if (MOCK_TEAM_B) {
      return mockTeamB.analyseCohort(params);
    }

    try {
      return await this._fetch(`${this.baseUrl}/api/v1/analytics/analyse`, {
        method: 'POST',
        body: JSON.stringify(params)
      }, correlationId);
    } catch (err) {
      return mockTeamB.analyseCohort(params);
    }
  }

  /**
   * Get metrics
   */
  async getMetrics(correlationId) {
    if (MOCK_TEAM_B) {
      return mockTeamB.getMetrics();
    }

    try {
      return await retryOperation(
        () => this._fetch(`${this.baseUrl}/api/v1/metrics/ranking`, { method: 'GET' }, correlationId),
        { maxRetries: 1 }
      );
    } catch (err) {
      return mockTeamB.getMetrics();
    }
  }

  /**
   * Health ping
   */
  async checkHealth() {
    try {
      const res = await withTimeout(fetch(`${this.baseUrl}/health`), 1500, 'Team B Health');
      const data = await res.json();
      return { status: 'ONLINE', details: data };
    } catch (err) {
      return { status: 'DEGRADED', fallback: true, error: err.message };
    }
  }
}

module.exports = new TeamBClient();
