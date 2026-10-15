/**
 * RIT Placement Portal — SPA entry point: route table with role-based access, SSE bootstrap.
 */
document.addEventListener('DOMContentLoaded', () => {
  const R = window.router;
  const V = window.views;
  const S = ['student'];
  const STAFF = ['faculty', 'admin'];
  const ALL_STAFF = ['faculty', 'admin', 'auditor'];

  // ── Student ────────────────────────────────────────────────────────────────
  R.register('/student/dashboard', () => V.student.renderDashboard(), S, { refresh: true });
  R.register('/student/drives', () => V.student.renderDrives(), S, { refresh: true });
  R.register('/student/drives/:driveId', (p) => V.student.renderDriveDetail(p.driveId), S);
  R.register('/student/applications', () => V.student.renderApplications(), S, { refresh: true });
  R.register('/student/applications/:applicationId', (p) => V.student.renderApplicationDetail(p.applicationId), S, { refresh: true });
  R.register('/student/interviews', () => V.student.renderInterviews(), S, { refresh: true });
  R.register('/student/offers', () => V.student.renderOffers(), S, { refresh: true });
  R.register('/student/eligibility', () => V.student.renderEligibility(), S);
  R.register('/student/rankings', () => V.student.renderRankings(), S);
  R.register('/student/profile', () => V.student.renderProfile(), S);

  // Notifications are available to every signed-in role
  R.register('/student/notifications', () => V.student.renderNotifications(), ['student', 'faculty', 'admin', 'auditor'], { refresh: true });
  R.register('/account', () => V.renderAccount(), ['student', 'faculty', 'admin', 'auditor']);

  // ── Faculty / TPO (admins may open everything) ─────────────────────────────
  R.register('/faculty/dashboard', () => V.faculty.renderDashboard(), STAFF, { refresh: true });
  R.register('/faculty/applications', () => V.faculty.renderApplications(), STAFF, { refresh: true });
  R.register('/faculty/applications/:applicationId', (p) => V.student.renderApplicationDetail(p.applicationId), STAFF, { refresh: true });
  R.register('/faculty/interviews', () => V.faculty.renderInterviews(), STAFF, { refresh: true });
  R.register('/faculty/drives', () => V.admin.renderDrives(), STAFF, { refresh: true });
  R.register('/faculty/companies', () => V.admin.renderCompanies(), STAFF, { refresh: true });
  R.register('/faculty/students', () => V.faculty.renderStudents(), STAFF, { refresh: true });
  R.register('/faculty/announcements', () => V.faculty.renderAnnouncements(), STAFF, { refresh: true });
  R.register('/faculty/rankings', () => V.faculty.renderRankings(), STAFF);
  R.register('/faculty/analytics', () => V.faculty.renderAnalytics(), ALL_STAFF);
  R.register('/faculty/reports', () => V.faculty.renderReports(), ALL_STAFF);

  // ── Admin ──────────────────────────────────────────────────────────────────
  R.register('/admin/dashboard', () => V.admin.renderDashboard(), ['admin', 'auditor'], { refresh: true });
  R.register('/admin/users', () => V.admin.renderUsers(), ['admin'], { refresh: true });
  R.register('/admin/companies', () => V.admin.renderCompanies(), STAFF, { refresh: true });
  R.register('/admin/drives', () => V.admin.renderDrives(), STAFF, { refresh: true });
  R.register('/admin/applications/:applicationId', (p) => V.student.renderApplicationDetail(p.applicationId), STAFF, { refresh: true });
  R.register('/admin/students', () => V.faculty.renderStudents(), STAFF, { refresh: true });
  R.register('/admin/applications', () => V.faculty.renderApplications(), STAFF, { refresh: true });
  R.register('/admin/announcements', () => V.faculty.renderAnnouncements(), STAFF, { refresh: true });
  R.register('/admin/rankings', () => V.faculty.renderRankings(), STAFF);
  R.register('/admin/analytics', () => V.faculty.renderAnalytics(), ['admin', 'auditor']);
  R.register('/admin/reports', () => V.faculty.renderReports(), ['admin', 'auditor']);
  R.register('/admin/audit', () => V.admin.renderAudit(), ['admin', 'auditor']);
  R.register('/admin/system', () => V.admin.renderSystem(), ['admin', 'auditor']);

  // Reflect login/logout in the shell without a full reload
  window.store.subscribe('user', () => { window.__unreadLoaded = false; });

  if (window.api.isAuthenticated()) window.sseClient.connect();
  window.store.subscribe('user', (u) => { if (u) window.sseClient.connect(); });

  R.handleRoute();
});
