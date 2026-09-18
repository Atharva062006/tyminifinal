/**
 * Role-aware RIT Institutional Header, Blue Primary Navigation Bar, and Announcement Component for RIT Portal.
 */

window.components = window.components || {};

window.components.renderHeader = function () {
  const user = window.store.get('user');
  const streamStatus = window.store.get('streamStatus') || 'OFFLINE';
  const lastEventTime = window.store.get('lastEventTime');
  const hash = window.location.hash || '#/';

  let statusClass = 'disconnected';
  let statusText = 'OFFLINE';
  if (streamStatus === 'LIVE') {
    statusClass = 'live';
    statusText = 'LIVE ●';
  } else if (streamStatus === 'RECONNECTING') {
    statusClass = 'reconnecting';
    statusText = 'RECONNECTING ⟳';
  }

  const formattedTime = lastEventTime ? new Date(lastEventTime).toLocaleTimeString() : '—';
  const role = user?.role || 'student';

  // Role-based Navigation Bar Items
  let navItems = [];
  if (role === 'student') {
    navItems = [
      { path: '#/student/dashboard', label: 'Dashboard' },
      { path: '#/student/drives', label: 'Placements' },
      { path: '#/student/applications', label: 'Applications' },
      { path: '#/student/rankings', label: 'Rankings' },
      { path: '#/student/interviews', label: 'Interviews' },
      { path: '#/student/offers', label: 'Offers' },
      { path: '#/student/notifications', label: 'Notifications' },
      { path: '#/student/eligibility', label: 'Eligibility' },
      { path: '#/student/profile', label: 'Profile' }
    ];
  } else if (role === 'faculty' || role === 'tpo') {
    navItems = [
      { path: '#/faculty/dashboard', label: 'Dashboard' },
      { path: '#/admin/drives', label: 'Drives' },
      { path: '#/faculty/applications', label: 'Applications' },
      { path: '#/faculty/rankings', label: 'Rankings' },
      { path: '#/faculty/analytics', label: 'Analytics' },
      { path: '#/faculty/reports', label: 'Reports' }
    ];
  } else if (role === 'admin') {
    navItems = [
      { path: '#/admin/dashboard', label: 'Dashboard' },
      { path: '#/admin/drives', label: 'Companies' },
      { path: '#/admin/dashboard', label: 'Users' },
      { path: '#/admin/drives', label: 'Drives' },
      { path: '#/faculty/analytics', label: 'Analytics' },
      { path: '#/faculty/reports', label: 'Reports' },
      { path: '#/admin/audit', label: 'Audit Logs' },
      { path: '#/admin/system', label: 'System' }
    ];
  }

  const navLinksHtml = navItems.map(item => {
    const isActive = hash.startsWith(item.path);
    return `
      <li class="nav-bar-item ${isActive ? 'active' : ''}">
        <a href="${item.path}">
          <span>${item.label}</span>
        </a>
      </li>
    `;
  }).join('');

  return `
    <header id="institutional-header" role="banner">
      <!-- 1. Top Clean White Institutional Branding & User Profile Bar -->
      <div class="top-header-bar">
        <div class="header-brand">
          <div class="brand-logo-img">
            <img src="assets/logo.jpg" alt="RIT Logo" />
          </div>
          <div class="brand-titles">
            <h1 class="brand-name">Rajarambapu Institute of Technology</h1>
            <span class="brand-sub">RIT CAMPUS PLACEMENT & ELIGIBILITY PORTAL</span>
          </div>
        </div>

        <div class="header-actions">
          <!-- Live Stream Status -->
          <div class="live-indicator-container" title="Server-Sent Events Stream: Updated at ${formattedTime}" aria-live="polite">
            <span class="live-dot ${statusClass}"></span>
            <span style="color: ${statusClass === 'live' ? 'var(--accent-emerald)' : 'var(--accent-amber)'}">${statusText}</span>
          </div>

          <!-- Announcement / Notification Bell -->
          <button id="announcement-bell-btn" class="btn btn-secondary btn-sm" title="Campus Notifications & Feed" aria-label="Open Notifications">
            <span id="announcement-badge" class="badge badge-open" style="font-size: 0.7rem; padding: 0.15rem 0.4rem;">Alerts</span>
          </button>

          ${user ? `
            <!-- User Profile Avatar Card & Logout -->
            <div class="header-user-card">
              <div class="user-avatar">${(user.name || user.id || 'U').charAt(0).toUpperCase()}</div>
              <div class="user-details">
                <span class="user-display-name">${user.name || user.id}</span>
                <span class="user-role-label">${role.toUpperCase()}</span>
              </div>
              <button id="logout-btn" class="btn btn-ghost btn-sm" title="Log out of session" aria-label="Logout" style="color: #dc2626;">
                Logout
              </button>
            </div>
          ` : `
            <a href="#/login" class="btn btn-primary btn-sm">Login</a>
          `}

          <!-- Mobile Hamburger Toggle -->
          <button id="mobile-menu-btn" class="btn btn-secondary btn-sm" aria-label="Toggle navigation menu" style="display: none;">
            Menu
          </button>
        </div>
      </div>

      <!-- 2. Primary Royal Blue Navigation Bar (Below Header) -->
      ${user ? `
        <nav id="primary-nav-bar" class="nav-bar-blue" role="navigation" aria-label="Primary Navigation">
          <div class="nav-bar-container">
            <ul class="nav-bar-menu">
              ${navLinksHtml}
            </ul>
          </div>
        </nav>
      ` : ''}
    </header>
  `;
};

window.components.renderSidebar = function () {
  return ''; // Replaced by horizontal blue navigation bar
};

// Global Notification Dropdown Modal Trigger
document.addEventListener('click', async (e) => {
  if (e.target.closest('#announcement-bell-btn')) {
    try {
      const notifData = await window.api.getNotifications();
      const notifs = notifData.notifications || [];
      const unreadCount = notifData.unread_count !== undefined ? notifData.unread_count : notifs.filter(n => !n.read).length;
      const streamStatus = window.store.get('streamStatus') || 'OFFLINE';

      let sseLabel = streamStatus === 'LIVE' ? 'Live updates connected' : 'Connecting live stream...';

      const contentHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
          <span style="font-size: 0.8rem; color: ${streamStatus === 'LIVE' ? 'var(--accent-emerald)' : 'var(--accent-amber)'}; font-weight: 700;">● ${sseLabel}</span>
          <button id="modal-mark-all-btn" class="btn btn-secondary btn-sm">Mark All Read</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 380px; overflow-y: auto; padding-right: 0.25rem;">
          ${notifs && notifs.length > 0 ? notifs.map(n => `
            <div style="background: ${!n.read ? '#eff6ff' : '#f8fafc'}; padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid ${!n.read ? '#bfdbfe' : 'var(--border-color)'};">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                <div>
                  <strong style="color: var(--rit-navy); font-size: 0.9rem;">${n.title}</strong>
                  ${!n.read ? `<span style="background: var(--rit-blue); width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-left: 0.4rem;" title="Unread"></span>` : ''}
                  <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0.25rem 0;">${n.message}</p>
                  <span style="font-size: 0.7rem; color: var(--text-muted);">${n.created_at ? new Date(n.created_at).toLocaleTimeString() : 'Just now'}</span>
                </div>
                ${!n.read ? `<button class="btn btn-ghost btn-sm modal-mark-item-btn" data-id="${n.id}">Mark Read</button>` : ''}
              </div>
            </div>
          `).join('') : '<p style="text-align: center; color: var(--text-muted); padding: 2rem 0;">No notifications at this time.</p>'}
        </div>

        <div style="margin-top: 1rem; text-align: center; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
          <a href="#/student/notifications" class="btn btn-primary btn-sm" onclick="window.modal.close()" style="background: var(--rit-blue);">Go to Notification Center →</a>
        </div>
      `;

      window.modal.open({
        title: `Notifications (${unreadCount} Unread)`,
        contentHtml,
        buttons: [{ text: 'Close', className: 'btn-secondary', onClick: () => true }]
      });

      document.getElementById('modal-mark-all-btn')?.addEventListener('click', async () => {
        try {
          await window.api.markAllNotificationsRead();
          window.toast.success('All notifications marked as read');
          window.modal.close();
        } catch (err) {
          window.toast.error('Failed to mark all as read');
        }
      });

      document.querySelectorAll('.modal-mark-item-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          try {
            await window.api.markNotificationRead(id);
            window.toast.success('Marked as read');
            window.modal.close();
          } catch (err) {
            window.toast.error('Failed to mark notification as read');
          }
        });
      });

    } catch (err) {
      window.toast.error('Failed to load notifications');
    }
  }
});
