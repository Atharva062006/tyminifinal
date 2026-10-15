/**
 * Mock Adapter for Team C — DBMS Engine (Port 3003).
 * Used only when MOCK_TEAM_C=true (offline demos and the BFF unit tests). It enforces the same
 * state machine and role permissions as the real service so tests exercise realistic behaviour.
 */
const { v4: uuidv4 } = require('uuid');
const { VALID_TRANSITIONS } = require('../../../../shared/constants');
const { AppError, NotFoundError, ConflictError, ForbiddenError, ValidationError, InvalidTransitionError, UnauthorizedError } = require('../../../../shared/errors');

const STAFF = ['faculty', 'admin'];
const PERMS = {
  SHORTLISTED: STAFF, WAITLISTED: STAFF, REJECTED: STAFF, INTERVIEW_SCHEDULED: STAFF, SELECTED: STAFF, OFFER_ISSUED: STAFF,
  OFFER_ACCEPTED: ['student'], OFFER_DECLINED: ['student'], WITHDRAWN: ['student', ...STAFF],
};

const iso = (d = 0) => new Date(Date.now() + d * 86400000).toISOString();

class MockTeamC {
  constructor() { this.reset(); }

  reset() {
    this.students = [
      { student_id: 'STU001', name: 'Aarav Sharma', email: 'aarav@rit.edu', branch: 'CSE', cgpa: 8.9, backlogs: 0, attendance: 88, skills: ['JavaScript', 'Python', 'SQL'] },
      { student_id: 'STU002', name: 'Rohan Patil', email: 'rohan@rit.edu', branch: 'CSE', cgpa: 7.4, backlogs: 1, attendance: 75, skills: ['Java', 'Spring', 'MySQL'] },
      { student_id: 'STU003', name: 'Ananya Mehta', email: 'ananya@rit.edu', branch: 'IT', cgpa: 9.1, backlogs: 0, attendance: 92, skills: ['React', 'Node.js', 'MongoDB'] },
      { student_id: 'STU004', name: 'Devraj Kumar', email: 'devraj@rit.edu', branch: 'CSE', cgpa: 6.8, backlogs: 2, attendance: 70, skills: ['C++', 'DSA'] },
      { student_id: 'STU005', name: 'Isha Joshi', email: 'isha@rit.edu', branch: 'ENTC', cgpa: 8.2, backlogs: 0, attendance: 85, skills: ['Python', 'ML', 'TensorFlow'] },
    ];
    this.companies = [
      { company_id: 'COM001', name: 'TechCorp India', industry: 'IT Services', website: 'https://techcorp.in' },
      { company_id: 'COM002', name: 'DataSoft', industry: 'Analytics', website: 'https://datasoft.io' },
    ];
    this.drives = [
      { drive_id: 'DRV001', company_id: 'COM001', title: 'SDE Intern 2026', seats: 10, seats_total: 10, package: 600000, state: 'OPEN', version: 1,
        criteria_json: JSON.stringify({ min_cgpa: 7.0, max_backlogs: 1, branches: ['CSE', 'IT'], min_attendance: 75, required_skills: ['JavaScript', 'Python'] }) },
      { drive_id: 'DRV002', company_id: 'COM002', title: 'Data Analyst 2026', seats: 5, seats_total: 5, package: 750000, state: 'OPEN', version: 1,
        criteria_json: JSON.stringify({ min_cgpa: 8.0, max_backlogs: 0, branches: ['CSE', 'IT', 'ENTC'], min_attendance: 80, required_skills: ['Python', 'SQL'] }) },
    ];
    this.applications = new Map([
      ['APP-001', { application_id: 'APP-001', student_id: 'STU001', drive_id: 'DRV001', state: 'RULE_EVALUATED', version: 2, consent: true, created_at: iso(-3), updated_at: iso(-2) }],
      ['APP-002', { application_id: 'APP-002', student_id: 'STU002', drive_id: 'DRV001', state: 'RULE_EVALUATED', version: 2, consent: true, created_at: iso(-3), updated_at: iso(-2) }],
    ]);
    this.interviews = [];
    this.offers = [];
    this.notifications = [
      { notification_id: 'NOTIF-001', recipient_id: 'STU001', type: 'INTERVIEW_SCHEDULED', title: 'Interview scheduled', message: 'Technical interview scheduled.', entity_id: 'APP-001', read: false, created_at: iso(-0.1) },
      { notification_id: 'NOTIF-002', recipient_id: 'STU001', type: 'SHORTLISTED', title: 'You have been shortlisted', message: 'Shortlisted for SDE Intern 2026.', entity_id: 'APP-001', read: false, created_at: iso(-0.2) },
      { notification_id: 'NOTIF-003', recipient_id: 'FAC001', type: 'APPLICATION_SUBMITTED', title: 'New eligible application', message: 'Aarav Sharma applied for SDE Intern 2026.', entity_id: 'APP-001', read: false, created_at: iso(-0.3) },
    ];
    this.announcements = [{ announcement_id: 'ANN-001', title: 'Campus Placement Registration Open', content: 'Registration is open.', author: 'TPO Office', created_at: iso(-5) }];
    this.users = [
      { user_id: 'FAC001', username: 'tpo@rit.edu', password: 'faculty123', role: 'faculty', name: 'Prof. Rajesh Kulkarni (TPO)', active: true },
      { user_id: 'ADM001', username: 'admin@rit.edu', password: 'admin123', role: 'admin', name: 'Prof. Suresh Deshmukh', active: true },
      ...this.students.map(s => ({ user_id: s.student_id, username: s.email, password: 'student123', role: 'student', name: s.name, student_id: s.student_id, active: true })),
    ];
    this.audit = [];
  }

  // ── Auth ──
  _pub(u) { return { id: u.student_id || u.user_id, user_id: u.user_id, role: u.role, name: u.name, email: u.username, student_id: u.student_id || null, active: u.active }; }
  async login({ username, password }) {
    const u = this.users.find(x => x.username === String(username || '').toLowerCase());
    if (!u || u.password !== password) throw new UnauthorizedError('Invalid e-mail or password');
    if (!u.active) throw new UnauthorizedError('This account has been deactivated.');
    const s = this.students.find(x => x.student_id === u.student_id) || {};
    return { token: `${u.role}_${u.student_id || u.user_id}`, user: { ...this._pub(u), branch: s.branch, cgpa: s.cgpa, skills: s.skills } };
  }
  async register(b) {
    if (this.users.some(u => u.username === String(b.email).toLowerCase())) throw new ConflictError('An account with this e-mail already exists');
    if (!b.name || !b.email || !b.password || b.password.length < 6) throw new ValidationError('Registration details are invalid');
    const id = `STU${String(this.students.length + 1).padStart(3, '0')}`;
    const s = { student_id: id, name: b.name, email: b.email.toLowerCase(), branch: b.branch, cgpa: Number(b.cgpa), backlogs: Number(b.backlogs || 0), attendance: Number(b.attendance || 80), skills: b.skills || [] };
    this.students.push(s);
    const u = { user_id: id, username: s.email, password: b.password, role: 'student', name: s.name, student_id: id, active: true };
    this.users.push(u);
    return { token: `student_${id}`, user: this._pub(u), student: s };
  }
  async me(id) { const u = this.users.find(x => x.user_id === id || x.student_id === id); if (!u) throw new NotFoundError('User', id); return this._pub(u); }
  async listUsers() { return this.users.map(u => this._pub(u)); }
  async createUser(b) {
    const id = `${{ faculty: 'FAC', admin: 'ADM', auditor: 'AUD' }[b.role] || 'USR'}${String(this.users.length + 1).padStart(3, '0')}`;
    const u = { user_id: id, username: String(b.email).toLowerCase(), password: b.password, role: b.role, name: b.name, active: true };
    this.users.push(u);
    return this._pub(u);
  }
  async updateUser(id, b) {
    const u = this.users.find(x => x.user_id === id);
    if (!u) throw new NotFoundError('User', id);
    if (b.active !== undefined) u.active = Boolean(b.active);
    if (b.role) u.role = b.role;
    return this._pub(u);
  }
  async changePassword() { return { changed: true }; }

  // ── Master data ──
  async listCompanies() { return this.companies; }
  async getCompany(id) { return this.companies.find(c => c.company_id === id); }
  async createCompany(c) { const row = { company_id: `COM${String(this.companies.length + 1).padStart(3, '0')}`, ...c }; this.companies.push(row); return row; }
  async updateCompany(id, u) { const c = this.companies.find(x => x.company_id === id); if (!c) throw new NotFoundError('Company', id); return Object.assign(c, u); }
  async listStudents() { return this.students; }
  async getStudent(id) { return this.students.find(s => s.student_id === id); }
  async createStudent(b) { return (await this.register({ password: 'student123', ...b })).student; }
  async updateStudent(id, updates, actor = {}) {
    const s = this.students.find(x => x.student_id === id);
    if (!s) throw new NotFoundError('Student', id);
    if (updates.cgpa !== undefined && !(Number(updates.cgpa) >= 0 && Number(updates.cgpa) <= 10)) throw new ValidationError('Schema validation failed for students', [{ field: 'cgpa', message: 'cgpa failed check constraint' }]);
    const academic = ['cgpa', 'backlogs', 'attendance', 'branch'].some(k => updates[k] !== undefined && updates[k] !== s[k]);
    Object.assign(s, updates);
    if (actor.role === 'student' && academic) s.academic_verified = false;
    return s;
  }
  async listDrives(state) { return state ? this.drives.filter(d => d.state === state) : this.drives; }
  async getDrive(id) { return this.drives.find(d => d.drive_id === id); }
  async createDrive(d) {
    const row = { drive_id: `DRV${String(this.drives.length + 1).padStart(3, '0')}`, version: 1, state: 'DRAFT', ...d, seats_total: d.seats };
    if (d.criteria) { row.criteria_json = JSON.stringify(d.criteria); delete row.criteria; }
    this.drives.push(row);
    return row;
  }
  async updateDrive(id, updates) {
    const d = this.drives.find(x => x.drive_id === id);
    if (!d) throw new NotFoundError('Drive', id);
    return Object.assign(d, updates);
  }

  // ── Applications ──
  async createApplication(data) {
    const dup = [...this.applications.values()].find(a => a.idempotency_key && a.idempotency_key === data.idempotency_key);
    if (dup) return dup;
    const active = [...this.applications.values()].find(a => a.student_id === data.student_id && a.drive_id === data.drive_id && !['WITHDRAWN', 'NOT_ELIGIBLE', 'REJECTED', 'EXPIRED'].includes(a.state));
    if (active) throw new ConflictError(`Student '${data.student_id}' already has an active application for drive '${data.drive_id}'`);
    const id = `APP-${uuidv4().substring(0, 8)}`;
    const rec = { application_id: id, student_id: data.student_id, drive_id: data.drive_id, state: 'APPLIED', version: 1, consent: data.consent, idempotency_key: data.idempotency_key, created_at: iso(), updated_at: iso() };
    this.applications.set(id, rec);
    return rec;
  }
  async listApplications(f = {}) {
    let list = [...this.applications.values()];
    if (f.student_id) list = list.filter(a => a.student_id === f.student_id);
    if (f.drive_id) list = list.filter(a => a.drive_id === f.drive_id);
    if (f.state) list = list.filter(a => a.state === f.state);
    return list;
  }
  async getApplication(id) { return this.applications.get(id); }
  async transition(id, target, { actor = {}, payload = {}, reason } = {}) {
    const app = this.applications.get(id);
    if (!app) throw new NotFoundError('Application', id);
    const allowed = PERMS[target] || [];
    if (!allowed.includes(actor.role)) throw new ForbiddenError(`Role '${actor.role}' may not move an application to ${target}`);
    if (actor.role === 'student' && actor.id !== app.student_id) throw new ForbiddenError('Students may only act on their own applications');
    if (!(VALID_TRANSITIONS[app.state] || []).includes(target)) throw new InvalidTransitionError(app.state, target);
    if (target === 'OFFER_ISSUED' && !(Number(payload.package_ctc || 600000) > 0)) throw new ValidationError('A positive package_ctc is required');
    app.state = target;
    app.version += 1;
    app.updated_at = iso();
    if (reason) app.status_reason = reason;
    if (target === 'OFFER_ISSUED') this.offers.push({ offer_id: `OFR-${uuidv4().substring(0, 6)}`, application_id: id, student_id: app.student_id, drive_id: app.drive_id, status: 'COMMITTED', package_ctc: Number(payload.package_ctc || 600000), joining_date: payload.joining_date || null, created_at: iso() });
    if (target === 'OFFER_ACCEPTED' || target === 'OFFER_DECLINED') {
      const o = this.offers.find(x => x.application_id === id);
      if (o) o.status = target === 'OFFER_ACCEPTED' ? 'ACCEPTED' : 'DECLINED';
    }
    this.audit.push({ audit_id: uuidv4(), actor: actor.id, action: `STATE_TRANSITION:->${target}`, table_name: 'applications', record_id: id, timestamp: iso() });
    return { ...app, offer_id: (this.offers.find(o => o.application_id === id) || {}).offer_id || null };
  }
  async withdrawApplication(id, actor) { return this.transition(id, 'WITHDRAWN', { actor }); }
  async scheduleInterview(id, payload = {}, actor = {}) {
    const app = this.applications.get(id);
    if (!app) throw new NotFoundError('Application', id);
    if (!STAFF.includes(actor.role)) throw new ForbiddenError('Only the placement cell can schedule interviews');
    if (!['SHORTLISTED', 'INTERVIEW_SCHEDULED'].includes(app.state)) throw new ConflictError(`Interviews can only be scheduled for SHORTLISTED applications (current: ${app.state})`);
    const at = payload.scheduled_at || iso(1);
    const slot = `${app.drive_id}@${at}`;
    if (this.interviews.some(i => i.slot_id === slot && i.status === 'SCHEDULED')) throw new ConflictError(`Interview slot ${at} is already booked by another candidate`);
    const iv = { interview_id: `INT-${uuidv4().substring(0, 6)}`, application_id: id, student_id: app.student_id, drive_id: app.drive_id, round_name: payload.round_name || 'Technical Interview', scheduled_at: at, mode: payload.mode || 'Online', location_url: payload.location_url || 'https://meet.jit.si/rit-placement-interview', slot_id: slot, status: 'SCHEDULED' };
    this.interviews.push(iv);
    if (app.state === 'SHORTLISTED') { app.state = 'INTERVIEW_SCHEDULED'; app.version += 1; }
    return { ...app, interview: iv };
  }
  async listInterviews(f = {}) {
    let l = this.interviews;
    if (f.student_id) l = l.filter(i => i.student_id === f.student_id);
    if (f.application_id) l = l.filter(i => i.application_id === f.application_id);
    if (f.drive_id) l = l.filter(i => i.drive_id === f.drive_id);
    return l;
  }
  async updateInterview(id, status) { const i = this.interviews.find(x => x.interview_id === id); if (!i) throw new NotFoundError('Interview', id); i.status = status; return i; }
  async listOffers(f = {}) {
    let l = this.offers;
    if (f.student_id) l = l.filter(o => o.student_id === f.student_id);
    if (f.application_id) l = l.filter(o => o.application_id === f.application_id);
    return l;
  }
  async applicationDetails(id) {
    const application = this.applications.get(id);
    if (!application) throw new NotFoundError('Application', id);
    return { application, decisions: [], interviews: this.interviews.filter(i => i.application_id === id), offers: this.offers.filter(o => o.application_id === id), audit: this.audit.filter(a => a.record_id === id) };
  }
  async reevaluate(id) { const a = this.applications.get(id); if (!a) throw new NotFoundError('Application', id); return a; }

  // ── Notifications / announcements ──
  async listNotifications(recipient, unread) {
    let l = this.notifications.filter(n => n.recipient_id === recipient);
    const unreadCount = l.filter(n => !n.read).length;
    if (unread) l = l.filter(n => !n.read);
    return { notifications: l, unread_count: unreadCount, total: this.notifications.filter(n => n.recipient_id === recipient).length };
  }
  async markNotificationRead(id, recipient) {
    const n = this.notifications.find(x => x.notification_id === id);
    if (!n) throw new NotFoundError('Notification', id);
    if (n.recipient_id !== recipient) throw new ForbiddenError('You can only modify your own notifications');
    n.read = true;
    return n;
  }
  async markAllNotificationsRead(recipient) { this.notifications.filter(n => n.recipient_id === recipient).forEach(n => { n.read = true; }); return { updated: 1 }; }
  async listAnnouncements() { return this.announcements; }
  async createAnnouncement(d, actor = {}) { const a = { announcement_id: `ANN-${Date.now()}`, ...d, author: actor.name || d.author || 'TPO Office', created_at: iso() }; this.announcements.unshift(a); return a; }
  async deleteAnnouncement(id) { this.announcements = this.announcements.filter(a => a.announcement_id !== id); return { deleted: true }; }
}

module.exports = new MockTeamC();
