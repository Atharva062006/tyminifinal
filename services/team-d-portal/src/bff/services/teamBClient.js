/**
 * Client for Team B — DS Ranking Engine (Port 3002).
 * Timeout control, safe retries and a visible fallback: if Team B is unreachable the local mock ranking
 * answers and the request is flagged as degraded (meta.degraded) so the UI says so.
 */
const { withTimeout } = require('../utils/timeout');
const { retryOperation } = require('../utils/retry');
const degraded = require('../utils/degraded');
const mockTeamB = require('../../mocks/mockTeamB');

const TEAM_B_BASE_URL = process.env.TEAM_B_BASE_URL || process.env.TEAM_B_URL || 'http://localhost:3002';
const MOCK_TEAM_B = process.env.MOCK_TEAM_B === 'true';
const TIMEOUT_MS = parseInt(process.env.TEAM_B_TIMEOUT_MS || '3000', 10);

class TeamBClient {
  constructor(baseUrl = TEAM_B_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async _fetch(url, options = {}, correlationId = 'unknown') {
    const headers = { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId, ...(options.headers || {}) };
    const response = await withTimeout(fetch(url, { ...options, headers }), TIMEOUT_MS, `Team B (${url})`);
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

  async _withFallback(label, real, fallback) {
    if (MOCK_TEAM_B) return fallback();
    try {
      return await real();
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) throw err;
      console.warn(`[Team B Client] ${label} failed (${err.message}). Using local fallback.`);
      degraded.mark('team-b', `Ranking engine unreachable — ${label} served by local fallback`);
      return fallback();
    }
  }

  /** Compute candidate rankings for a drive. */
  computeRanking(payload, correlationId) {
    return this._withFallback('computeRanking',
      () => this._fetch(`${this.baseUrl}/api/v1/rankings/compute`, { method: 'POST', body: JSON.stringify(payload) }, correlationId),
      async () => ({ ...(await mockTeamB.computeRanking(payload)), degraded: true }));
  }

  getRanking(rankingId, correlationId) {
    return this._withFallback('getRanking',
      () => retryOperation(() => this._fetch(`${this.baseUrl}/api/v1/rankings/${rankingId}`, { method: 'GET' }, correlationId), { maxRetries: 1 }),
      () => mockTeamB.getRanking(rankingId));
  }

  getProfiles(correlationId) {
    return this._withFallback('getProfiles',
      () => retryOperation(() => this._fetch(`${this.baseUrl}/api/v1/profiles`, { method: 'GET' }, correlationId), { maxRetries: 1 }),
      () => mockTeamB.getProfiles());
  }

  /** Cohort & performance analytics (B4). */
  analyseCohort(params, correlationId) {
    return this._withFallback('analyseCohort',
      () => this._fetch(`${this.baseUrl}/api/v1/analytics/analyse`, { method: 'POST', body: JSON.stringify(params) }, correlationId),
      () => mockTeamB.analyseCohort(params));
  }

  getMetrics(correlationId) {
    return this._withFallback('getMetrics',
      () => retryOperation(() => this._fetch(`${this.baseUrl}/api/v1/metrics/ranking`, { method: 'GET' }, correlationId), { maxRetries: 1 }),
      () => mockTeamB.getMetrics());
  }

  runBenchmark(params, correlationId) {
    return this._fetch(`${this.baseUrl}/internal/v1/benchmark`, { method: 'POST', body: JSON.stringify(params || {}) }, correlationId);
  }

  lookupShortlist(key, via, correlationId) {
    return this._fetch(`${this.baseUrl}/internal/v1/shortlist-index/${encodeURIComponent(key)}?via=${via === 'avl' ? 'avl' : 'hash'}`, { method: 'GET' }, correlationId);
  }

  invalidateCache(scope, correlationId) {
    return this._fetch(`${this.baseUrl}/internal/v1/shortlist-cache/invalidate`, { method: 'POST', body: JSON.stringify(scope || {}) }, correlationId);
  }

  skillSuggestions(prefix, correlationId) {
    return this._fetch(`${this.baseUrl}/api/v1/profiles/skills?prefix=${encodeURIComponent(prefix || '')}`, { method: 'GET' }, correlationId);
  }

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
