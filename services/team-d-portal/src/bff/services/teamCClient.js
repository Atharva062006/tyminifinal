/**
 * Client for Team C — DBMS Engine & Authoritative Placement Data (Port 3003).
 *
 * - Propagates X-Correlation-ID, Idempotency-Key and the acting user (X-Actor-Id / X-Actor-Role) behind the
 *   shared service secret, so Team C authorises and audits the real person.
 * - Team C is the system of record: when it is unreachable the BFF answers with an explicit 503 instead of
 *   inventing data. Mock adapters are used only when MOCK_TEAM_C=true (offline demo / unit tests).
 */
const { withTimeout } = require('../utils/timeout');
const { retryOperation } = require('../utils/retry');
const { AppError } = require('../../../../../shared/errors');
const mock = require('../../mocks/mockTeamC');

const TEAM_C_BASE_URL = process.env.TEAM_C_BASE_URL || process.env.TEAM_C_URL || 'http://localhost:3003';
const MOCK_TEAM_C = process.env.MOCK_TEAM_C === 'true';
const TIMEOUT_MS = parseInt(process.env.TEAM_C_TIMEOUT_MS || '4000', 10);
const SECRET = () => process.env.INTERNAL_SERVICE_SECRET || 'rit_placement_internal_secret_key';

class TeamCClient {
  constructor(baseUrl = TEAM_C_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async _fetch(endpoint, { method = 'GET', body, headers = {} } = {}, correlationId = 'unknown', actor = null) {
    const h = {
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
      'X-Internal-Secret': SECRET(),
      ...(actor ? { 'X-Actor-Id': actor.id, 'X-Actor-Role': actor.role, ...(actor.name ? { 'X-Actor-Name': encodeURIComponent(actor.name) } : {}) } : {}),
      ...headers,
    };
    const res = await withTimeout(fetch(`${this.baseUrl}${endpoint}`, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined }), TIMEOUT_MS, `Team C (${endpoint})`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new AppError(data.error?.code || 'TEAM_C_ERROR', data.error?.message || `Team C error: ${res.statusText}`, res.status, data.error?.details || []);
      err.upstream = true;
      throw err;
    }
    return data.data !== undefined ? data.data : data;
  }

  /**
   * Unified call: real service first. A real HTTP error from Team C is passed through unchanged (so a 404 stays a 404);
   * only a connectivity failure triggers the mock (when enabled) or an explicit 503.
   */
  async _call(method, endpoint, { body, headers, correlationId, actor, mockFn, nullOn404 = false, retry = false } = {}) {
    if (MOCK_TEAM_C) return mockFn();
    try {
      const run = () => this._fetch(endpoint, { method, body, headers }, correlationId, actor);
      return await (retry ? retryOperation(run, { maxRetries: 1 }) : run());
    } catch (err) {
      if (err instanceof AppError) {
        if (nullOn404 && err.statusCode === 404) return null;
        throw err;
      }
      throw new AppError('TEAM_C_UNAVAILABLE', 'The placement database (Team C) is temporarily unreachable. Please retry in a moment.', 503,
        [{ reason: err.message }]);
    }
  }

  _qs(obj = {}) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : '';
  }

  // ── Auth & users ─────────────────────────────────────────────────────────
  login(body, correlationId) { return this._call('POST', '/api/v1/auth/login', { body, correlationId, mockFn: () => mock.login(body) }); }
  register(body, correlationId) { return this._call('POST', '/api/v1/auth/register', { body, correlationId, mockFn: () => mock.register(body) }); }
  me(actor, correlationId) { return this._call('GET', '/api/v1/auth/me', { actor, correlationId, mockFn: () => mock.me(actor.id) }); }
  changePassword(body, actor, correlationId) { return this._call('POST', '/api/v1/auth/change-password', { body, actor, correlationId, mockFn: () => mock.changePassword(body) }); }
  listUsers(actor, correlationId) { return this._call('GET', '/api/v1/users', { actor, correlationId, mockFn: () => mock.listUsers() }); }
  createUser(body, actor, correlationId) { return this._call('POST', '/api/v1/users', { body, actor, correlationId, mockFn: () => mock.createUser(body) }); }
  updateUser(id, body, actor, correlationId) { return this._call('PATCH', `/api/v1/users/${id}`, { body, actor, correlationId, mockFn: () => mock.updateUser(id, body) }); }

  // ── Companies ────────────────────────────────────────────────────────────
  listCompanies(correlationId) { return this._call('GET', '/api/v1/companies', { correlationId, retry: true, mockFn: () => mock.listCompanies() }); }
  getCompany(id, correlationId) { return this._call('GET', `/api/v1/companies/${id}`, { correlationId, nullOn404: true, mockFn: () => mock.getCompany(id) }); }
  createCompany(body, actor, correlationId) { return this._call('POST', '/api/v1/companies', { body, actor, correlationId, mockFn: () => mock.createCompany(body) }); }
  updateCompany(id, body, actor, correlationId) { return this._call('PATCH', `/api/v1/companies/${id}`, { body, actor, correlationId, mockFn: () => mock.updateCompany(id, body) }); }

  // ── Students ─────────────────────────────────────────────────────────────
  listStudents(correlationId, filters = {}) { return this._call('GET', `/api/v1/students${this._qs(filters)}`, { correlationId, retry: true, mockFn: () => mock.listStudents() }); }
  getStudent(id, correlationId) { return this._call('GET', `/api/v1/students/${id}`, { correlationId, nullOn404: true, retry: true, mockFn: () => mock.getStudent(id) }); }
  createStudent(body, actor, correlationId) { return this._call('POST', '/api/v1/students', { body, actor, correlationId, mockFn: () => mock.createStudent(body) }); }
  updateStudent(id, body, correlationId, actor) { return this._call('PATCH', `/api/v1/students/${id}`, { body, actor, correlationId, mockFn: () => mock.updateStudent(id, body, actor) }); }

  // ── Drives ───────────────────────────────────────────────────────────────
  listDrives(filter = {}, correlationId) { return this._call('GET', `/api/v1/drives${this._qs({ state: filter.state })}`, { correlationId, retry: true, mockFn: () => mock.listDrives(filter.state) }); }
  getDrive(id, correlationId) { return this._call('GET', `/api/v1/drives/${id}`, { correlationId, nullOn404: true, retry: true, mockFn: () => mock.getDrive(id) }); }
  async getDriveCriteria(id, correlationId) {
    const d = await this.getDrive(id, correlationId);
    if (!d) return null;
    return { drive_id: d.drive_id, seats: d.seats, criteria: d.criteria_json ? JSON.parse(d.criteria_json) : {} };
  }
  createDrive(body, actor, correlationId) { return this._call('POST', '/api/v1/drives', { body, actor, correlationId, mockFn: () => mock.createDrive(body) }); }
  updateDrive(id, body, correlationId, actor) { return this._call('PATCH', `/api/v1/internal/drives/${id}`, { body, actor, correlationId, mockFn: () => mock.updateDrive(id, body) }); }

  // ── Applications & workflow ──────────────────────────────────────────────
  createApplication(payload, idempotencyKey, correlationId, actor) {
    return this._call('POST', '/api/v1/applications', {
      body: { ...payload, idempotency_key: idempotencyKey }, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
      actor, correlationId, mockFn: () => mock.createApplication({ ...payload, idempotency_key: idempotencyKey }),
    });
  }
  listApplications(filters = {}, correlationId, actor) {
    return this._call('GET', `/api/v1/applications${this._qs(filters)}`, { actor, correlationId, retry: true, mockFn: () => mock.listApplications(filters) });
  }
  getApplication(id, correlationId, actor) { return this._call('GET', `/api/v1/applications/${id}`, { actor, correlationId, nullOn404: true, retry: true, mockFn: () => mock.getApplication(id) }); }
  getApplicationDetails(id, correlationId, actor) { return this._call('GET', `/api/v1/applications/${id}/details`, { actor, correlationId, nullOn404: true, mockFn: () => mock.applicationDetails(id) }); }
  withdrawApplication(id, correlationId, actor) { return this._call('POST', `/api/v1/applications/${id}/withdraw`, { actor, correlationId, mockFn: () => mock.withdrawApplication(id, actor) }); }
  transition(id, targetState, { reason, payload, expectedVersion } = {}, correlationId, actor) {
    return this._call('POST', `/api/v1/applications/${id}/transition`, {
      body: { target_state: targetState, reason, payload, expected_version: expectedVersion }, actor, correlationId,
      mockFn: () => mock.transition(id, targetState, { actor, payload, reason }),
    });
  }
  scheduleInterview(id, body, correlationId, actor) { return this._call('POST', `/api/v1/applications/${id}/interviews`, { body, actor, correlationId, mockFn: () => mock.scheduleInterview(id, body, actor) }); }
  reevaluate(id, correlationId, actor) { return this._call('POST', `/api/v1/applications/${id}/reevaluate`, { actor, correlationId, mockFn: () => mock.reevaluate(id) }); }
  listInterviews(filters, correlationId, actor) { return this._call('GET', `/api/v1/interviews${this._qs(filters)}`, { actor, correlationId, mockFn: () => mock.listInterviews(filters) }); }
  updateInterview(id, status, correlationId, actor) { return this._call('PATCH', `/api/v1/interviews/${id}`, { body: { status }, actor, correlationId, mockFn: () => mock.updateInterview(id, status) }); }
  listOffers(filters, correlationId, actor) { return this._call('GET', `/api/v1/offers${this._qs(filters)}`, { actor, correlationId, mockFn: () => mock.listOffers(filters) }); }

  // ── Notifications & announcements ────────────────────────────────────────
  listNotifications(filters, correlationId, actor) { return this._call('GET', `/api/v1/notifications${this._qs(filters)}`, { actor, correlationId, mockFn: () => mock.listNotifications(actor.id, filters?.unread === 'true') }); }
  markNotificationRead(id, correlationId, actor) { return this._call('PATCH', `/api/v1/notifications/${id}/read`, { actor, correlationId, mockFn: () => mock.markNotificationRead(id, actor.id) }); }
  markAllNotificationsRead(correlationId, actor) { return this._call('POST', '/api/v1/notifications/read-all', { actor, correlationId, mockFn: () => mock.markAllNotificationsRead(actor.id) }); }
  listAnnouncements(correlationId) { return this._call('GET', '/api/v1/announcements', { correlationId, mockFn: () => mock.listAnnouncements() }); }
  createAnnouncement(body, correlationId, actor) { return this._call('POST', '/api/v1/announcements', { body, actor, correlationId, mockFn: () => mock.createAnnouncement(body, actor) }); }
  deleteAnnouncement(id, correlationId, actor) { return this._call('DELETE', `/api/v1/announcements/${id}`, { actor, correlationId, mockFn: () => mock.deleteAnnouncement(id) }); }

  // ── Reports, audit, recovery ─────────────────────────────────────────────
  getPlacementPerformance(params = {}, correlationId, actor) {
    return this._call('GET', `/api/v1/reports/placement-performance${this._qs(params)}`, {
      actor: actor || { id: 'system', role: 'admin' }, correlationId,
      mockFn: () => ({
        generated_at: new Date().toISOString(),
        totals: { total_applications: 5, total_selected: 3, total_offers_issued: 2, overall_conversion: '60.0%' },
        drive_stats: [{ drive_id: 'DRV001', title: 'SDE Intern 2026', seats_total: 10, seats_remaining: 8, applications: 3, selected: 2, offers_issued: 1, package_lpa: 600000, conversion_rate: '66.7%' }],
        branch_stats: [{ branch: 'CSE', total_students: 25, applications: 3, selected: 2, conversion_rate: '66.7%' }, { branch: 'IT', total_students: 20, applications: 2, selected: 1, conversion_rate: '50.0%' }],
        package_distribution: { min_lpa: 600000, max_lpa: 750000, avg_lpa: 675000, count: 2 },
      }),
    });
  }
  queryAudit(filters = {}, correlationId, actor) {
    return this._call('GET', `/api/v1/audit${this._qs(filters)}`, {
      actor: actor || { id: 'system', role: 'admin' }, correlationId,
      mockFn: () => ({ entries: mock.audit.slice(-50), total: mock.audit.length }),
    });
  }
  reconciliation(correlationId, actor) { return this._call('GET', '/api/v1/reports/reconciliation', { actor, correlationId, mockFn: () => ({ consistent: true, applications_missing_decision: [], seat_reconciliation: [], checked_applications: mock.applications.size }) }); }
  recoveryVerify(correlationId, actor) { return this._call('POST', '/api/v1/internal/recovery/verify', { actor, correlationId, mockFn: () => ({ status: 'SUCCESS', replayed_transactions: 0, recovery_time_ms: 1 }) }); }
  recoveryBackup(correlationId, actor) { return this._call('POST', '/api/v1/internal/recovery/backup', { actor, correlationId, mockFn: () => ({ backup_id: 'mock', tables_copied: 0, took_ms: 0 }) }); }
  recoveryVerifyRestore(body, correlationId, actor) { return this._call('POST', '/api/v1/internal/recovery/verify-restore', { body, actor, correlationId, mockFn: () => ({ status: 'SUCCESS', tables_with_drift: 0, rto_met: true, reconciliation: [] }) }); }

  // ── Health ───────────────────────────────────────────────────────────────
  async checkHealth() {
    try {
      const res = await withTimeout(fetch(`${this.baseUrl}/health`), 1500, 'Team C Health');
      const data = await res.json();
      return { status: 'ONLINE', details: data };
    } catch (err) {
      return { status: 'DEGRADED', fallback: MOCK_TEAM_C, error: err.message };
    }
  }
}

module.exports = new TeamCClient();
