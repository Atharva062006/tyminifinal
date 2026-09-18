/**
 * APNILEAP — Team D Frontend API Client
 * Manages HTTP communication with the Team D BFF, attaches session tokens,
 * propagates X-Correlation-ID, and manages idempotency keys for mutations.
 */

// Generate standard UUIDv4 for browser
function generateUUID() {
  if (crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class ApiClient {
  constructor(baseUrl = '/api/v1/ui') {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('apnileap_token') || null;
    this.user = JSON.parse(localStorage.getItem('apnileap_user') || 'null');
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

  clearSession() {
    this.setSession(null, null);
  }

  isAuthenticated() {
    return !!this.token;
  }

  getUser() {
    return this.user;
  }

  async request(endpoint, options = {}) {
    const correlationId = generateUUID();
    const headers = {
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
      ...(this.token ? { 'Authorization': this.token } : {}),
      ...(options.headers || {})
    };

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const res = await fetch(url, {
        ...options,
        headers
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Handle 401 Unauthorized - redirect to login
        if (res.status === 401 && !endpoint.includes('/session')) {
          this.clearSession();
          window.location.hash = '#/login';
        }

        const err = new Error(json.error?.message || `HTTP ${res.status}: ${res.statusText}`);
        err.statusCode = res.status;
        err.code = json.error?.code || 'UNKNOWN_ERROR';
        err.details = json.error?.details || [];
        err.correlationId = json.meta?.correlation_id || correlationId;
        throw err;
      }

      return json.data !== undefined ? json.data : json;
    } catch (err) {
      if (!err.statusCode) {
        err.code = 'NETWORK_ERROR';
        err.message = 'Unable to connect to placement portal server';
      }
      throw err;
    }
  }

  // ── Authentication ────────────────────────────────────────────────────────
  async login(role, userId = null, username = null) {
    const data = await this.request('/session', {
      method: 'POST',
      body: JSON.stringify({ role, user_id: userId, username })
    });
    this.setSession(data.token, data.user);
    return data;
  }

  async logout() {
    try {
      await this.request('/session', { method: 'DELETE' });
    } catch {}
    this.clearSession();
  }

  async getMe() {
    return this.request('/me');
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  async getDashboard() {
    return this.request('/dashboard');
  }

  // ── Drives & Companies ───────────────────────────────────────────────────
  async getDrives(filters = {}) {
    const qs = new URLSearchParams(filters).toString();
    return this.request(`/drives${qs ? `?${qs}` : ''}`);
  }

  async getCompanies() {
    return this.request('/companies');
  }

  async getDrive(driveId) {
    return this.request(`/drives/${driveId}`);
  }

  async updateDrive(driveId, updates) {
    return this.request(`/drives/${driveId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async checkEligibility(driveId, studentId = null) {
    const qs = studentId ? `?student_id=${studentId}` : '';
    return this.request(`/eligibility/check/${driveId}${qs}`);
  }

  // ── Applications ──────────────────────────────────────────────────────────
  async getApplications(filters = {}) {
    const qs = new URLSearchParams(filters).toString();
    return this.request(`/applications${qs ? `?${qs}` : ''}`);
  }

  async getApplication(applicationId) {
    return this.request(`/applications/${applicationId}`);
  }

  async createApplication(payload, idempotencyKey = null) {
    const idempKey = idempotencyKey || generateUUID();
    return this.request('/applications', {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempKey
      },
      body: JSON.stringify({
        ...payload,
        idempotency_key: idempKey
      })
    });
  }

  async withdrawApplication(applicationId) {
    return this.request(`/applications/${applicationId}/withdraw`, {
      method: 'POST'
    });
  }

  // ── Rankings ──────────────────────────────────────────────────────────────
  async getRankings(driveId = null, algorithm = 'WEIGHTED_SCORE') {
    const params = {};
    if (driveId) params.drive_id = driveId;
    if (algorithm) params.algorithm = algorithm;
    const qs = new URLSearchParams(params).toString();
    return this.request(`/rankings${qs ? `?${qs}` : ''}`);
  }

  async previewRanking(driveId, algorithm, weights) {
    return this.request('/rankings/preview', {
      method: 'POST',
      body: JSON.stringify({ drive_id: driveId, algorithm, weights })
    });
  }

  // ── Reports & Audit ───────────────────────────────────────────────────────
  async getPlacementReports(filters = {}) {
    const qs = new URLSearchParams(filters).toString();
    return this.request(`/reports/placement-performance${qs ? `?${qs}` : ''}`);
  }

  async getAuditLogs(filters = {}) {
    const qs = new URLSearchParams(filters).toString();
    return this.request(`/audit${qs ? `?${qs}` : ''}`);
  }

  // ── System Health ─────────────────────────────────────────────────────────
  async getSystemHealth() {
    return this.request('/system');
  }

  // ── Student Profile & Placement Readiness ──────────────────────────────────
  async getStudentProfile(studentId) {
    return this.request(`/students/${studentId}`);
  }

  async updateStudentProfile(studentId, updates) {
    return this.request(`/students/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async getPlacementReadiness(studentId) {
    return this.request(`/students/${studentId}/readiness`);
  }

  // ── System Announcements ────────────────────────────────────────────────────
  async getAnnouncements() {
    return this.request('/announcements');
  }

  async createAnnouncement(data) {
    return this.request('/announcements', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // ── Interview Scheduling & Offer Decision ───────────────────────────────────
  async scheduleInterview(applicationId, data) {
    return this.request(`/applications/${applicationId}/interviews`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async shortlistCandidate(applicationId) {
    return this.request(`/applications/${applicationId}/shortlist`, {
      method: 'POST'
    });
  }

  async issueOffer(applicationId, data = {}) {
    return this.request(`/applications/${applicationId}/offer`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async submitOfferDecision(applicationId, decision) {
    return this.request(`/applications/${applicationId}/offer-decision`, {
      method: 'POST',
      body: JSON.stringify({ decision })
    });
  }

  // ── Notifications ───────────────────────────────────────────────────────────
  async getNotifications(filters = {}) {
    const qs = new URLSearchParams(filters).toString();
    return this.request(`/notifications${qs ? `?${qs}` : ''}`);
  }

  async markNotificationRead(id) {
    return this.request(`/notifications/${id}/read`, {
      method: 'PATCH'
    });
  }

  async markAllNotificationsRead() {
    return this.request('/notifications/read-all', {
      method: 'POST'
    });
  }

  // ── Analytics & Reports ───────────────────────────────────────────────────
  async getAnalytics(filters = {}) {
    const qs = new URLSearchParams(filters).toString();
    return this.request(`/analytics${qs ? `?${qs}` : ''}`);
  }

  async exportReport(type = 'placement_performance', format = 'csv', filters = {}) {
    const params = new URLSearchParams({ type, format, ...filters }).toString();
    return this.request(`/reports/export?${params}`);
  }
}

window.api = new ApiClient();
