/**
 * Team D Frontend API Client — talks only to the Team D BFF (/api/v1/ui).
 * Attaches the session token, propagates X-Correlation-ID, sends idempotency keys for creates,
 * and publishes meta.degraded so the UI can warn when an engine answered from a fallback.
 */

function generateUUID() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

class ApiClient {
  constructor(baseUrl = '/api/v1/ui') {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('apnileap_token') || null;
    this.user = JSON.parse(localStorage.getItem('apnileap_user') || 'null');
    this.lastDegraded = null;
  }

  setSession(token, user) {
    this.token = token;
    this.user = user;
    if (token) {
      localStorage.setItem('apnileap_token', token);
      localStorage.setItem('apnileap_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('apnileap_token');
      localStorage.removeItem('apnileap_user');
    }
  }

  clearSession() { this.setSession(null, null); }
  isAuthenticated() { return !!this.token; }
  getUser() { return this.user; }
  rawToken() { return this.token ? this.token.replace(/^Bearer /, '') : null; }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Correlation-ID': generateUUID(),
      ...(this.token ? { Authorization: this.token } : {}),
      ...(options.headers || {}),
    };

    let res;
    try {
      res = await fetch(`${this.baseUrl}${endpoint}`, { ...options, headers });
    } catch (e) {
      const err = new Error('Unable to connect to the placement portal server');
      err.code = 'NETWORK_ERROR';
      throw err;
    }

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 && !endpoint.startsWith('/session') && !endpoint.startsWith('/register')) {
        this.clearSession();
        window.store && window.store.set('user', null);
        window.location.hash = '#/login';
      }
      const err = new Error(json.error?.message || `HTTP ${res.status}: ${res.statusText}`);
      err.statusCode = res.status;
      err.code = json.error?.code || 'UNKNOWN_ERROR';
      err.details = json.error?.details || [];
      err.correlationId = json.meta?.correlation_id;
      throw err;
    }

    const degraded = json.meta?.degraded || null;
    if (JSON.stringify(degraded) !== JSON.stringify(this.lastDegraded)) {
      this.lastDegraded = degraded;
      if (window.store) window.store.set('degraded', degraded);
    }
    return json.data !== undefined ? json.data : json;
  }

  post(path, body, headers) { return this.request(path, { method: 'POST', body: JSON.stringify(body || {}), headers }); }
  patch(path, body) { return this.request(path, { method: 'PATCH', body: JSON.stringify(body || {}) }); }
  put(path, body) { return this.request(path, { method: 'PUT', body: JSON.stringify(body || {}) }); }
  del(path) { return this.request(path, { method: 'DELETE' }); }
  qs(filters = {}) {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
    const s = p.toString();
    return s ? `?${s}` : '';
  }

  // ── Authentication ────────────────────────────────────────────────────────
  async login(username, password) {
    const data = await this.post('/session', { username, password });
    this.setSession(data.token, data.user);
    return data;
  }
  async register(payload) {
    const data = await this.post('/register', payload);
    this.setSession(data.token, data.user);
    return data;
  }
  async logout() { try { await this.del('/session'); } catch { /* stateless token */ } this.clearSession(); }
  getMe() { return this.request('/me'); }
  changePassword(current_password, new_password) { return this.post('/me/password', { current_password, new_password }); }

  // ── Dashboard / notifications / announcements ─────────────────────────────
  getDashboard() { return this.request('/dashboard'); }
  getNotifications(filters = {}) { return this.request(`/notifications${this.qs(filters)}`); }
  markNotificationRead(id) { return this.patch(`/notifications/${id}/read`); }
  markAllNotificationsRead() { return this.post('/notifications/read-all'); }
  getAnnouncements() { return this.request('/announcements'); }
  createAnnouncement(data) { return this.post('/announcements', data); }
  deleteAnnouncement(id) { return this.del(`/announcements/${id}`); }

  // ── Companies & drives ────────────────────────────────────────────────────
  getCompanies() { return this.request('/companies'); }
  createCompany(data) { return this.post('/companies', data); }
  updateCompany(id, data) { return this.patch(`/companies/${id}`, data); }
  getDrives(filters = {}) { return this.request(`/drives${this.qs(filters)}`); }
  getDrive(id) { return this.request(`/drives/${id}`); }
  createDrive(data) { return this.post('/drives', data); }
  updateDrive(id, data) { return this.patch(`/drives/${id}`, data); }
  checkEligibility(driveId, studentId = null, strategy = null) { return this.request(`/eligibility/check/${driveId}${this.qs({ student_id: studentId, strategy })}`); }

  // ── Applications & workflow ───────────────────────────────────────────────
  getApplications(filters = {}) { return this.request(`/applications${this.qs(filters)}`); }
  getApplication(id) { return this.request(`/applications/${id}`); }
  createApplication(payload, idempotencyKey = null) {
    const key = idempotencyKey || generateUUID();
    return this.post('/applications', { ...payload, idempotency_key: key }, { 'Idempotency-Key': key });
  }
  withdrawApplication(id) { return this.post(`/applications/${id}/withdraw`); }
  shortlistCandidate(id) { return this.post(`/applications/${id}/shortlist`); }
  rejectCandidate(id, reason) { return this.post(`/applications/${id}/reject`, { reason }); }
  waitlistCandidate(id, reason) { return this.post(`/applications/${id}/waitlist`, { reason }); }
  selectCandidate(id) { return this.post(`/applications/${id}/select`); }
  scheduleInterview(id, data) { return this.post(`/applications/${id}/interviews`, data); }
  issueOffer(id, data = {}) { return this.post(`/applications/${id}/offer`, data); }
  submitOfferDecision(id, decision) { return this.post(`/applications/${id}/offer-decision`, { decision }); }
  reevaluate(id) { return this.post(`/applications/${id}/reevaluate`); }
  getInterviews(filters = {}) { return this.request(`/interviews${this.qs(filters)}`); }
  updateInterview(id, status) { return this.patch(`/interviews/${id}`, { status }); }
  getOffers(filters = {}) { return this.request(`/offers${this.qs(filters)}`); }

  // ── Rankings ──────────────────────────────────────────────────────────────
  getRankings(driveId = null, algorithm = 'WEIGHTED_SCORE') { return this.request(`/rankings${this.qs({ drive_id: driveId, algorithm })}`); }
  previewRanking(driveId, algorithm, weights) { return this.post('/rankings/preview', { drive_id: driveId, algorithm, weights }); }

  // ── Students ──────────────────────────────────────────────────────────────
  getStudents(filters = {}) { return this.request(`/students${this.qs(filters)}`); }
  createStudent(data) { return this.post('/students', data); }
  getStudentProfile(id) { return this.request(`/students/${id}`); }
  updateStudentProfile(id, data) { return this.patch(`/students/${id}`, data); }
  getPlacementReadiness(id) { return this.request(`/students/${id}/readiness`); }

  // ── Reports, analytics, audit ─────────────────────────────────────────────
  getPlacementReports(filters = {}) { return this.request(`/reports/placement-performance${this.qs(filters)}`); }
  getAnalytics(filters = {}) { return this.request(`/analytics${this.qs(filters)}`); }
  getAuditLogs(filters = {}) { return this.request(`/audit${this.qs(filters)}`); }

  /** Download a CSV/JSON export (fetch → Blob → save) with the session token attached. */
  async downloadReport(type = 'placement_performance', format = 'csv', filters = {}) {
    const res = await fetch(`${this.baseUrl}/reports/export${this.qs({ type, format, ...filters })}`, { headers: { Authorization: this.token } });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const err = new Error(j.error?.message || `Export failed (HTTP ${res.status})`);
      err.code = j.error?.code;
      throw err;
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rit_${type}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ── Administration & system ───────────────────────────────────────────────
  getUsers() { return this.request('/users'); }
  createUser(data) { return this.post('/users', data); }
  updateUser(id, data) { return this.patch(`/users/${id}`, data); }
  getSystemHealth() { return this.request('/system'); }
  runBenchmark(team, params = {}) { return this.post(`/system/benchmark/${team}`, params); }
  getQueuePolicy() { return this.request('/system/team-a/policy'); }
  setQueuePolicy(policy) { return this.put('/system/team-a/policy', { policy }); }
  getLocks() { return this.request('/system/team-a/locks'); }
  analyseDeadlocks(edges) { return this.post('/system/team-a/deadlocks', { edges }); }
  skillSuggestions(prefix) { return this.request(`/system/team-b/skills${this.qs({ prefix })}`); }
  shortlistLookup(key, via) { return this.request(`/system/team-b/shortlist${this.qs({ key, via })}`); }
  invalidateRankingCache(driveId) { return this.post('/system/team-b/cache/invalidate', driveId ? { drive_id: driveId } : {}); }
  getReconciliation() { return this.request('/system/reconciliation'); }
  recoveryVerify() { return this.post('/system/recovery/verify'); }
  recoveryBackup() { return this.post('/system/recovery/backup'); }
  recoveryVerifyRestore(backupId) { return this.post('/system/recovery/verify-restore', backupId ? { backup_id: backupId } : {}); }
}

window.api = new ApiClient();
