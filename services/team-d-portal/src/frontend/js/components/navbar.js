/**
 * Application shell: top bar (brand, live status, notifications, user menu) and role-aware sidebar.
 * Each nav group is tagged with the team that owns the capability behind it.
 */
window.components = window.components || {};

const ICONS = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  briefcase: 'M3 7h18v13H3zM8 7V4h8v3M3 13h18',
  file: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
  rank: 'M5 21V11M12 21V4M19 21v-7',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  gift: 'M3 9h18v4H3zM5 13v8h14v-8M12 9v12M8 9a2.5 2.5 0 1 1 4-2.5A2.5 2.5 0 1 1 16 9',
  bell: 'M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0',
  check: 'M4 12l5 5L20 6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 21a7 7 0 0 1 14 0M17 4a3.5 3.5 0 0 1 0 7M22 21a7 7 0 0 0-4-6',
  building: 'M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2M17 13h1M17 17h1M3 21h18',
  chart: 'M4 20V4M4 20h16M8 16l4-5 3 3 5-7',
  doc: 'M7 3h10v18H7zM10 8h4M10 12h4M10 16h2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  cpu: 'M7 7h10v10H7zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4',
  megaphone: 'M3 11v3l12 5V6zM15 8a4 4 0 0 1 0 8M6 14l1 6h3l-1-5',
  grad: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name] || ICONS.home}"/></svg>`;

const NAV = {
  student: [
    { title: 'My Placement', team: ['D', 'C'], items: [
      { path: '#/student/dashboard', label: 'Dashboard', icon: 'home' },
      { path: '#/student/drives', label: 'Drives & Companies', icon: 'briefcase' },
      { path: '#/student/applications', label: 'My Applications', icon: 'file' },
      { path: '#/student/interviews', label: 'Interviews', icon: 'calendar' },
      { path: '#/student/offers', label: 'Offers', icon: 'gift' },
    ] },
    { title: 'Insights', team: ['A', 'B'], items: [
      { path: '#/student/eligibility', label: 'Eligibility Check', icon: 'check' },
      { path: '#/student/rankings', label: 'My Ranking', icon: 'rank' },
    ] },
    { title: 'Account', team: ['C'], items: [
      { path: '#/student/notifications', label: 'Notifications', icon: 'bell' },
      { path: '#/student/profile', label: 'My Profile', icon: 'user' },
    ] },
  ],
  faculty: [
    { title: 'Placement Cell', team: ['D', 'C'], items: [
      { path: '#/faculty/dashboard', label: 'Dashboard', icon: 'home' },
      { path: '#/faculty/applications', label: 'Review Applications', icon: 'file' },
      { path: '#/faculty/interviews', label: 'Interview Schedule', icon: 'calendar' },
      { path: '#/faculty/drives', label: 'Drives', icon: 'briefcase' },
      { path: '#/faculty/companies', label: 'Companies', icon: 'building' },
      { path: '#/faculty/students', label: 'Students', icon: 'grad' },
      { path: '#/faculty/announcements', label: 'Announcements', icon: 'megaphone' },
    ] },
    { title: 'Ranking & Analytics', team: ['B'], items: [
      { path: '#/faculty/rankings', label: 'Rankings', icon: 'rank' },
      { path: '#/faculty/analytics', label: 'Analytics', icon: 'chart' },
      { path: '#/faculty/reports', label: 'Reports & Export', icon: 'doc' },
    ] },
    { title: 'Account', team: ['C'], items: [
      { path: '#/student/notifications', label: 'Notifications', icon: 'bell' },
    ] },
  ],
  admin: [
    { title: 'Administration', team: ['D', 'C'], items: [
      { path: '#/admin/dashboard', label: 'Dashboard', icon: 'home' },
      { path: '#/admin/users', label: 'Users & Roles', icon: 'users' },
      { path: '#/admin/companies', label: 'Companies', icon: 'building' },
      { path: '#/admin/drives', label: 'Drives', icon: 'briefcase' },
      { path: '#/admin/students', label: 'Students', icon: 'grad' },
      { path: '#/admin/applications', label: 'Applications', icon: 'file' },
      { path: '#/admin/announcements', label: 'Announcements', icon: 'megaphone' },
    ] },
    { title: 'Insights', team: ['B'], items: [
      { path: '#/admin/rankings', label: 'Rankings', icon: 'rank' },
      { path: '#/admin/analytics', label: 'Analytics', icon: 'chart' },
      { path: '#/admin/reports', label: 'Reports & Export', icon: 'doc' },
    ] },
    { title: 'Assurance', team: ['C', 'A', 'B'], items: [
      { path: '#/admin/audit', label: 'Audit Logs', icon: 'shield' },
      { path: '#/admin/system', label: 'System & Engines', icon: 'cpu' },
    ] },
    { title: 'Account', team: ['C'], items: [{ path: '#/student/notifications', label: 'Notifications', icon: 'bell' }] },
  ],
  auditor: [
    { title: 'Assurance', team: ['C'], items: [
      { path: '#/admin/dashboard', label: 'Overview', icon: 'home' },
      { path: '#/admin/audit', label: 'Audit Logs', icon: 'shield' },
      { path: '#/admin/system', label: 'System & Engines', icon: 'cpu' },
      { path: '#/faculty/analytics', label: 'Analytics', icon: 'chart' },
      { path: '#/faculty/reports', label: 'Reports & Export', icon: 'doc' },
    ] },
  ],
};
window.components.homeFor = (role) => ({ admin: '#/admin/dashboard', auditor: '#/admin/dashboard', faculty: '#/faculty/dashboard' }[role] || '#/student/dashboard');
window.components.navFor = (role) => NAV[role === 'tpo' ? 'faculty' : role] || NAV.student;

window.components.renderHeader = function () {
  const user = window.store.get('user');
  if (!user) return '';
  const stream = window.store.get('streamStatus') || 'OFFLINE';
  const last = window.store.get('lastEventTime');
  const stale = stream === 'LIVE' && last && (Date.now() - new Date(last).getTime() > 60000);
  const cls = stream === 'LIVE' ? (stale ? 'stale' : 'live') : stream === 'RECONNECTING' ? 'stale' : 'down';
  const txt = stream === 'LIVE' ? (stale ? 'Stale' : 'Live') : stream === 'RECONNECTING' ? 'Reconnecting' : 'Offline';
  const unread = window.store.get('unreadCount') || 0;

  return `
    <div class="topbar">
      <div class="topbar-left">
        <button class="menu-btn" id="menu-btn" aria-label="Toggle navigation" aria-expanded="false">&#9776;</button>
        <a href="${window.components.homeFor(user.role)}" class="header-brand" style="text-decoration:none;" aria-label="RIT Placement home">
          <div class="brand-logo-img"><img src="assets/logo.jpg" alt="RIT logo" /></div>
          <div class="brand-titles">
            <span class="brand-name">RIT Placement Portal</span>
            <span class="brand-sub">Training &amp; Placement Cell</span>
          </div>
        </a>
      </div>
      <div class="topbar-right">
        <span class="live-pill ${cls}" title="Live updates from Team C outbox via Team D BFF. Last event: ${last ? esc(fmt.time(last)) : 'none yet'}" aria-live="polite"><span class="dot"></span><span class="txt">${txt}${last ? ' · ' + esc(fmt.time(last)) : ''}</span></span>
        <div class="user-menu">
          <button class="icon-btn" id="bell-btn" aria-label="Notifications (${unread} unread)" aria-haspopup="true">
            ${icon('bell').replace('<svg', '<svg width="18" height="18"')}
            ${unread ? `<span class="count">${unread > 99 ? '99+' : unread}</span>` : ''}
          </button>
          <div class="dropdown notif-panel" id="notif-panel" role="menu"></div>
        </div>
        <div class="user-menu">
          <button class="user-chip" id="user-chip" aria-haspopup="true" aria-label="Account menu">
            <span class="avatar">${esc(fmt.initial(user.name || user.id))}</span>
            <span class="who"><b>${esc(user.name || user.id)}</b><span>${esc(user.role)}</span></span>
          </button>
          <div class="dropdown" id="user-dropdown" role="menu">
            ${user.role === 'student' ? '<a href="#/student/profile" role="menuitem">My profile</a>' : ''}
            <a href="#/account" role="menuitem">Account &amp; password</a>
            <hr/>
            <button id="logout-btn" role="menuitem" style="color:#b91c1c;">Sign out</button>
          </div>
        </div>
      </div>
    </div>`;
};

window.components.renderSidebar = function () {
  const user = window.store.get('user');
  if (!user) return '';
  const hash = (window.location.hash || '').split('?')[0];
  const groups = window.components.navFor(user.role).map(g => `
    <div class="side-section">
      <div class="side-title">${esc(g.title)}</div>
      ${g.items.map(i => `<a class="side-link ${hash === i.path || (hash.startsWith(i.path + '/')) ? 'active' : ''}" href="${i.path}">${icon(i.icon)}<span>${esc(i.label)}</span></a>`).join('')}
    </div>`).join('');
  return `
    <nav aria-label="Primary navigation">${groups}</nav>
    <div class="side-footer">
      <div style="font-weight:700;color:#dbe7fb;margin-bottom:.35rem;">Who built what</div>
      <div class="legend-row"><span class="legend-dot" style="background:var(--team-a)"></span>Team A — eligibility rules, queues, slot locks</div>
      <div class="legend-row"><span class="legend-dot" style="background:var(--team-b)"></span>Team B — ranking, graph, analytics</div>
      <div class="legend-row"><span class="legend-dot" style="background:var(--team-c)"></span>Team C — database &amp; workflow</div>
      <div class="legend-row"><span class="legend-dot" style="background:var(--team-d)"></span>Team D — portal &amp; BFF</div>
    </div>`;
};

window.components.renderFooter = function () {
  return `<div class="footer-slim"><span>© 2026 Rajarambapu Institute of Technology · Training &amp; Placement Cell</span><span>Teams A + B + C + D integrated platform · <a href="#/account">Account</a></span></div>`;
};

/** Wire up dropdowns / logout / mobile menu / notification panel after the shell is rendered. */
window.components.bindShell = function () {
  const closeAll = () => document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
  const toggle = (id, e) => { e.stopPropagation(); const el = document.getElementById(id); const was = el.classList.contains('open'); closeAll(); if (!was) el.classList.add('open'); return !was; };

  document.getElementById('user-chip')?.addEventListener('click', (e) => toggle('user-dropdown', e));
  document.getElementById('bell-btn')?.addEventListener('click', async (e) => {
    if (!toggle('notif-panel', e)) return;
    const panel = document.getElementById('notif-panel');
    panel.innerHTML = '<div class="notif-item">Loading…</div>';
    try {
      const data = await window.api.getNotifications();
      const items = (data.notifications || []).slice(0, 8);
      window.store.set('unreadCount', data.unread_count || 0);
      panel.innerHTML = `
        <div class="row between" style="padding:.7rem 1rem;border-bottom:1px solid var(--border-color);">
          <b style="color:var(--rit-navy)">Notifications</b>
          <span class="row" style="gap:.5rem;">${window.components.teamTag('C', 'persisted')}<button class="link small" id="notif-readall">Mark all read</button></span>
        </div>
        ${items.length ? items.map(n => `<div class="notif-item ${n.read ? '' : 'unread'}" data-id="${esc(n.notification_id || n.id)}" data-entity="${esc(n.entity_id || '')}"><b>${esc(n.title)}</b>${esc(n.message)}<br><small>${esc(fmt.ago(n.created_at))}</small></div>`).join('') : '<div class="notif-item muted">You are all caught up.</div>'}
        <div style="padding:.6rem 1rem;text-align:center;"><a class="link small" href="#/student/notifications">View all notifications →</a></div>`;
      document.getElementById('notif-readall')?.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        await window.api.markAllNotificationsRead();
        window.store.set('unreadCount', 0);
        window.components.refreshHeader();
      });
      panel.querySelectorAll('.notif-item[data-id]').forEach(el => el.addEventListener('click', async () => {
        await window.api.markNotificationRead(el.dataset.id).catch(() => {});
        window.components.refreshUnread();
        if (el.dataset.entity && /^(APP|[0-9a-f]{8}-)/i.test(el.dataset.entity)) {
          const role = window.store.get('user')?.role;
          if (role === 'student') window.location.hash = `#/student/applications/${el.dataset.entity}`;
        }
        closeAll();
      }));
    } catch (err) {
      panel.innerHTML = `<div class="notif-item">${esc(window.components.errorText(err))}</div>`;
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await window.api.logout();
    window.sseClient.disconnect();
    window.store.set('user', null);
    window.location.hash = '#/login';
  });

  document.getElementById('menu-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = document.body.classList.toggle('nav-open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });
  document.getElementById('sidebar-container')?.addEventListener('click', (e) => { if (e.target.closest('a')) document.body.classList.remove('nav-open'); });
  if (!window.__shellDocBound) { window.__shellDocBound = true; document.addEventListener('click', () => document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'))); }
};

window.components.refreshHeader = function () {
  const header = document.getElementById('header-container');
  if (!header || !window.store.get('user')) return;
  header.innerHTML = window.components.renderHeader();
  window.components.bindShell();
};

window.components.refreshUnread = async function () {
  if (!window.store.get('user')) return;
  try {
    const data = await window.api.getNotifications({ unread: 'true' });
    const n = data.unread_count || 0;
    if (n !== window.store.get('unreadCount')) { window.store.set('unreadCount', n); window.components.refreshHeader(); }
  } catch { /* header badge is best-effort */ }
};
