/**
 * APNILEAP — Team D Frontend SPA Application Entry Point
 * Registers routes, subscribes to reactive store changes, connects SSE, and handles bootstrapping.
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[RIT] Initializing Placement Portal Single Page Application...');

  // ── Register SPA Routes with Role-Based Access Control ──────────────────

  // Student Views
  window.router.register('/student/dashboard', () => window.views.student.renderDashboard(), ['student']);
  window.router.register('/student/drives', () => window.views.student.renderDrives(), ['student']);
  window.router.register('/student/drives/:driveId', (params) => window.views.student.renderDriveDetail(params.driveId), ['student']);
  window.router.register('/student/applications', () => window.views.student.renderApplications(), ['student']);
  window.router.register('/student/applications/:applicationId', (params) => window.views.student.renderApplicationDetail(params.applicationId), ['student']);
  window.router.register('/student/interviews', () => window.views.student.renderInterviews(), ['student']);
  window.router.register('/student/offers', () => window.views.student.renderOffers(), ['student']);
  window.router.register('/student/notifications', () => window.views.student.renderNotifications(), ['student']);
  window.router.register('/student/eligibility', () => window.views.student.renderEligibility(), ['student']);
  window.router.register('/student/rankings', () => window.views.student.renderRankings(), ['student']);
  window.router.register('/student/profile', () => window.views.student.renderProfile(), ['student']);

  // Faculty / TPO Views
  window.router.register('/faculty/dashboard', () => window.views.faculty.renderDashboard(), ['faculty', 'admin', 'tpo']);
  window.router.register('/faculty/drives', () => window.views.admin.renderDrives(), ['faculty', 'admin', 'tpo']);
  window.router.register('/faculty/applications', () => window.views.faculty.renderApplications(), ['faculty', 'admin', 'tpo']);
  window.router.register('/faculty/rankings', () => window.views.faculty.renderRankings(), ['faculty', 'admin', 'tpo']);
  window.router.register('/faculty/analytics', () => window.views.faculty.renderAnalytics(), ['faculty', 'admin', 'tpo']);
  window.router.register('/faculty/reports', () => window.views.faculty.renderReports(), ['faculty', 'admin', 'tpo']);

  // Admin Views
  window.router.register('/admin/dashboard', () => window.views.admin.renderDashboard(), ['admin']);
  window.router.register('/admin/drives', () => window.views.admin.renderDrives(), ['admin', 'faculty', 'tpo']);
  window.router.register('/admin/applications', () => window.views.faculty.renderApplications(), ['admin']);
  window.router.register('/admin/analytics', () => window.views.faculty.renderAnalytics(), ['admin']);
  window.router.register('/admin/audit', () => window.views.admin.renderAudit(), ['admin']);
  window.router.register('/admin/system', () => window.views.admin.renderSystem(), ['admin']);

  // ── Reactive State Subscriptions ──────────────────────────────────────────

  // Update header stream status when stream status changes
  window.store.subscribe('streamStatus', () => {
    const headerContainer = document.getElementById('header-container');
    if (headerContainer && window.api.isAuthenticated()) {
      headerContainer.innerHTML = window.components.renderHeader();
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          await window.api.logout();
          window.sseClient.disconnect();
          window.location.hash = '#/login';
        });
      }
    }
  });

  // Re-render view on relevant data mutation from Team C outbox stream
  window.store.subscribe('dataMutation', (data) => {
    console.log('[App] Data mutation event received via SSE:', data);
    // Optionally trigger active route refresh if user is logged in
    const currentHash = window.location.hash;
    if (currentHash && currentHash !== '#/login') {
      window.router.handleRoute();
    }
  });

  // Automatically connect SSE stream if user session exists
  if (window.api.isAuthenticated()) {
    window.sseClient.connect();
  }

  // Handle Mobile Navigation Menu Toggle with ARIA State Update
  document.addEventListener('click', (e) => {
    const mobileBtn = e.target.closest('#mobile-menu-btn');
    if (mobileBtn) {
      const navBar = document.getElementById('primary-nav-bar');
      if (navBar) {
        const isClosed = navBar.classList.toggle('mobile-closed');
        mobileBtn.setAttribute('aria-expanded', String(!isClosed));
      }
    }
  });

  // Initial Route Handling
  window.router.handleRoute();
});

