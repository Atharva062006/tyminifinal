/**
 * HTTP clients Team C uses to call the computational engines (Team A, Team B).
 * Team C stays the system of record: it only sends snapshots and records the answers.
 * Every call carries X-Correlation-ID and a timeout; failures surface as thrown errors so the
 * workflow can degrade / compensate explicitly.
 */
const TEAM_A_URL = () => process.env.TEAM_A_URL || process.env.TEAM_A_BASE_URL || 'http://localhost:3001';
const TEAM_B_URL = () => process.env.TEAM_B_URL || process.env.TEAM_B_BASE_URL || 'http://localhost:3002';
const TIMEOUT_MS = () => parseInt(process.env.ENGINE_TIMEOUT_MS || '3000', 10);

async function call(base, path, { method = 'GET', body, correlationId } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS());
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(correlationId ? { 'X-Correlation-ID': correlationId } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json.error?.message || `${base}${path} -> HTTP ${res.status}`);
      err.statusCode = res.status;
      err.upstream = true;
      throw err;
    }
    return json.data !== undefined ? json.data : json;
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error(`Timeout calling ${base}${path}`);
      e.upstream = true;
      throw e;
    }
    err.upstream = true;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const teamA = {
  evaluate: (payload, correlationId) => call(TEAM_A_URL(), '/api/v1/eligibility/requests', { method: 'POST', body: payload, correlationId }),
  acquireSlot: (payload, correlationId) => call(TEAM_A_URL(), '/internal/v1/locks/acquire', { method: 'POST', body: payload, correlationId }),
  releaseLease: (leaseId, correlationId) => call(TEAM_A_URL(), `/internal/v1/locks/${encodeURIComponent(leaseId)}`, { method: 'DELETE', correlationId }),
  health: () => call(TEAM_A_URL(), '/health'),
};

const teamB = {
  compute: (payload, correlationId) => call(TEAM_B_URL(), '/api/v1/rankings/compute', { method: 'POST', body: payload, correlationId }),
  putStudent: (id, profile, correlationId) => call(TEAM_B_URL(), `/internal/v1/profiles/students/${encodeURIComponent(id)}`, { method: 'PUT', body: profile, correlationId }),
  putDrive: (id, profile, correlationId) => call(TEAM_B_URL(), `/internal/v1/profiles/drives/${encodeURIComponent(id)}`, { method: 'PUT', body: profile, correlationId }),
  sync: (payload, correlationId) => call(TEAM_B_URL(), '/internal/v1/profiles/sync', { method: 'POST', body: payload, correlationId }),
  health: () => call(TEAM_B_URL(), '/health'),
};

module.exports = { teamA, teamB };
