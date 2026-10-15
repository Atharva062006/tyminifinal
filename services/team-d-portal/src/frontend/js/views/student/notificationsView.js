/**
 * Notification centre (all roles): persisted by Team C, delivered live via SSE.
 */
window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderNotifications = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const role = window.store.get('user').role;
  const filter = window.__notifFilter = window.__notifFilter || 'ALL';
  const data = await window.api.getNotifications();
  const list = (data.notifications || []).filter(n => filter === 'ALL' || !n.read);
  window.store.set('unreadCount', data.unread_count || 0);

  const target = (n) => {
    if (!n.entity_id || !/^(APP|[0-9a-f]{8}-)/i.test(n.entity_id)) return null;
    return role === 'student' ? `#/student/applications/${n.entity_id}` : `#/faculty/applications/${n.entity_id}`;
  };
  const icons = { OFFER_ISSUED: '🎉', SELECTED: '🏆', SHORTLISTED: '⭐', INTERVIEW_SCHEDULED: '📅', REJECTED: '✖', NOT_ELIGIBLE: '⚠', ANNOUNCEMENT: '📢', APPLICATION_SUBMITTED: '📥', OFFER_ACCEPTED: '✅', OFFER_DECLINED: '↩' };

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Notifications', subtitle: `${data.unread_count || 0} unread · ${data.total || 0} total. New events arrive instantly while you are online.`,
      tags: [['C', 'persistent outbox'], ['D', 'live stream']],
      actions: `<button class="btn btn-secondary btn-sm" id="mark-all" ${data.unread_count ? '' : 'disabled'}>Mark all as read</button>`,
    })}
    ${window.components.tabs([{ id: 'ALL', label: 'All' }, { id: 'UNREAD', label: `Unread (${data.unread_count || 0})` }], filter)}
    <div class="card" style="padding:.25rem 1.25rem;">
      ${list.length ? list.map(n => {
        const href = target(n);
        return `<div class="list-item" style="${n.read ? '' : 'background:#f5f9ff;margin:0 -1.25rem;padding:.75rem 1.25rem;'}">
          <div class="row" style="align-items:flex-start;flex-wrap:nowrap;"><span style="font-size:1.25rem;">${icons[n.type] || '🔔'}</span>
            <div><b style="color:var(--rit-navy)">${esc(n.title)}</b> ${n.read ? '' : '<span class="chip" style="padding:0 .4rem;">new</span>'}<div class="sub small">${esc(n.message)}</div><div class="muted small">${esc(fmt.ago(n.created_at))}</div></div></div>
          <div class="row-actions">${href ? `<a class="btn btn-secondary btn-sm" href="${href}">Open</a>` : ''}${n.read ? '' : `<button class="btn btn-ghost btn-sm" data-read="${esc(n.notification_id)}">Mark read</button>`}</div>
        </div>`;
      }).join('') : window.components.emptyState(filter === 'UNREAD' ? 'No unread notifications' : 'No notifications yet', 'Status changes, interview invitations and announcements will show up here.')}
    </div>`;

  c.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { window.__notifFilter = b.dataset.tab; window.views.student.renderNotifications(); }));
  c.querySelectorAll('[data-read]').forEach(b => b.addEventListener('click', () => window.components.runAction(b, () => window.api.markNotificationRead(b.dataset.read), { refresh: async () => { await window.views.student.renderNotifications(); window.components.refreshHeader(); } })));
  document.getElementById('mark-all')?.addEventListener('click', (e) => window.components.runAction(e.currentTarget, () => window.api.markAllNotificationsRead(), { success: 'All notifications marked as read', refresh: async () => { await window.views.student.renderNotifications(); window.components.refreshHeader(); } }));
};
