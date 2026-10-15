/**
 * Client for Team A — OS Eligibility Engine (Port 3001).
 * Timeout control, safe retries and a visible fallback: if Team A is unreachable the local mock rule
 * evaluator answers, and the request is flagged as degraded (meta.degraded) so the UI says so.
 */
const { withTimeout } = require('../utils/timeout');
const { retryOperation } = require('../utils/retry');
const degraded = require('../utils/degraded');
const mockTeamA = require('../../mocks/mockTeamA');

const TEAM_A_BASE_URL = process.env.TEAM_A_BASE_URL || process.env.TEAM_A_URL || 'http://localhost:3001';
const MOCK_TEAM_A = process.env.MOCK_TEAM_A === 'true';
const TIMEOUT_MS = parseInt(process.env.TEAM_A_TIMEOUT_MS || '3000', 10);

class TeamAClient {
  constructor(baseUrl = TEAM_A_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async _fetch(url, options = {}, correlationId = 'unknown') {
    const headers = { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...(options.headers || {}) };
    const response = await withTimeout(fetch(url, { ...options, headers }), TIMEOUT_MS, `Team A (${url})`);
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

  /** Real call with fallback; 4xx answers from Team A (validation) are real answers and are not masked. */
  async _withFallback(label, real, fallback) {
    if (MOCK_TEAM_A) return fallback();
    try {
      return await real();
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) throw err;
      console.warn(`[Team A Client] ${label} failed (${err.message}). Using local fallback.`);
      degraded.mark('team-a', `Eligibility engine unreachable — ${label} served by local fallback`);
      return fallback();
    }
  }

  /** Evaluate student eligibility against drive criteria. */
  evaluateRules(student, driveCriteria, correlationId, strategy) {
    return this._withFallback('evaluateRules',
      () => retryOperation(() => this._fetch(`${this.baseUrl}/internal/v1/rules/evaluate`, {
        method: 'POST', body: JSON.stringify({ student, criteria: driveCriteria, strategy }),
      }, correlationId), { maxRetries: 1 }),
      async () => ({ ...mockTeamA.evaluateRules(student, driveCriteria, strategy), source: 'MOCK_FALLBACK' }));
  }

  createRequest(payload, correlationId) {
    return this._withFallback('createRequest',
      () => this._fetch(`${this.baseUrl}/api/v1/eligibility/requests`, { method: 'POST', body: JSON.stringify(payload) }, correlationId),
      () => mockTeamA.createRequest(payload, correlationId));
  }

  getDriveQueue(driveId, correlationId) {
    return this._withFallback('getDriveQueue',
      () => retryOperation(() => this._fetch(`${this.baseUrl}/api/v1/drives/${driveId}/queue`, { method: 'GET' }, correlationId), { maxRetries: 1 }),
      () => mockTeamA.getDriveQueue(driveId));
  }

  getMetrics(correlationId) {
    return this._withFallback('getMetrics',
      () => retryOperation(() => this._fetch(`${this.baseUrl}/api/v1/metrics/eligibility`, { method: 'GET' }, correlationId), { maxRetries: 1 }),
      () => mockTeamA.getMetrics());
  }

  /** Benchmarks / policy are only meaningful against the live engine: no fallback. */
  runBenchmark(params, correlationId) {
    return this._fetch(`${this.baseUrl}/internal/v1/benchmark`, { method: 'POST', body: JSON.stringify(params || {}) }, correlationId);
  }

  getPolicy(correlationId) { return this._fetch(`${this.baseUrl}/internal/v1/policy`, { method: 'GET' }, correlationId); }
  setPolicy(policy, correlationId) { return this._fetch(`${this.baseUrl}/internal/v1/policy`, { method: 'PUT', body: JSON.stringify({ policy }) }, correlationId); }
  listLocks(correlationId) { return this._fetch(`${this.baseUrl}/internal/v1/locks`, { method: 'GET' }, correlationId); }
  analyseDeadlocks(edges, correlationId) { return this._fetch(`${this.baseUrl}/internal/v1/deadlocks/analyse`, { method: 'POST', body: JSON.stringify({ edges }) }, correlationId); }

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
