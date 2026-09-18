/**
 * Student Notification Center View for Team D Frontend.
 * Clean RIT Institutional Design Theme with Real-Time SSE Status Telemetry.
 */

window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderNotifications = async function() {
  const container = document.getElementById('main-content');
  container.innerHTML = window.components.renderLoading('Fetching notifications...');

  try {
    const user = window.store.get('user') || {};
    const notifData = await window.api.getNotifications();
    const notifications = notifData.notifications || (Array.isArray(notifData) ? notifData : []);
    const unreadCount = notifData.unread_count !== undefined ? notifData.unread_count : notifications.filter(n => !n.read).length;
    const streamStatus = window.store.get('streamStatus') || 'OFFLINE';

    let sseLabel = 'Live updates connected';
    let sseBadgeClass = 'selected';
    if (streamStatus === 'RECONNECTING') {
      sseLabel = 'Reconnecting to SSE live updates...';
      sseBadgeClass = 'waitlisted';
    } else if (streamStatus === 'OFFLINE') {
      sseLabel = 'Live stream offline';
      sseBadgeClass = 'closed';
    }

    container.innerHTML = `
      <!-- Breadcrumb -->
      <div id="breadcrumb-bar" style="margin-bottom: 1.25rem;">
        <span style="color: var(--text-muted);">Home</span> / <strong style="color: var(--rit-navy);">Notifications</strong>
      </div>

      <!-- Page Header -->
      <div style="margin-bottom: 1.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--rit-navy); margin-bottom: 0.25rem;">Notification Center</h1>
            <p style="color: var(--text-secondary); font-size: 0.92rem;">Manage real-time placement alerts, interview calls, and institutional updates.</p>
          </div>
          <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            <span class="badge badge-${sseBadgeClass}" style="font-size: 0.82rem; padding: 0.45rem 0.85rem;">
              ● ${sseLabel}
            </span>
            <button id="mark-all-read-btn" class="btn btn-secondary btn-sm">
              Mark All as Read
            </button>
          </div>
        </div>
      </div>

      <!-- Category Filter Tabs -->
      <div class="card" style="margin-bottom: 1.5rem; background: #ffffff; padding: 0.75rem 1rem;">
        <div style="display: flex; gap: 0.5rem; overflow-x: auto; font-size: 0.85rem;">
          <button class="btn btn-ghost btn-sm notif-tab active" data-category="ALL">All (${notifications.length})</button>
          <button class="btn btn-ghost btn-sm notif-tab" data-category="UNREAD">Unread (${unreadCount})</button>
          <button class="btn btn-ghost btn-sm notif-tab" data-category="Announcement">Announcements</button>
          <button class="btn btn-ghost btn-sm notif-tab" data-category="Application">Applications</button>
          <button class="btn btn-ghost btn-sm notif-tab" data-category="Shortlist">Shortlists</button>
          <button class="btn btn-ghost btn-sm notif-tab" data-category="Interview">Interviews</button>
          <button class="btn btn-ghost btn-sm notif-tab" data-category="Offer">Offers</button>
        </div>
      </div>

      <!-- Notifications List Container -->
      <div id="notifications-list-container"></div>
    `;

    const listContainer = document.getElementById('notifications-list-container');
    const tabs = document.querySelectorAll('.notif-tab');

    const getCategoryIcon = (type) => {
      return '';
    };

    const renderList = (filterCategory = 'ALL') => {
      let filtered = notifications;
      if (filterCategory === 'UNREAD') {
        filtered = notifications.filter(n => !n.read);
      } else if (filterCategory !== 'ALL') {
        filtered = notifications.filter(n => (n.type || n.category || '').toLowerCase().includes(filterCategory.toLowerCase()));
      }

      if (!filtered || filtered.length === 0) {
        listContainer.innerHTML = `
          <div class="card" style="text-align: center; padding: 3.5rem 1rem;">
            <p style="color: var(--text-muted); font-size: 0.95rem;">No notifications found in this category.</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
          ${filtered.map(n => {
            const isUnread = !n.read;
            const icon = getCategoryIcon(n.type || n.category);

            return `
              <div class="card" style="background: ${isUnread ? '#eff6ff' : '#ffffff'}; border: 1px solid ${isUnread ? '#bfdbfe' : 'var(--border-color)'}; padding: 1.1rem; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
                  <div style="display: flex; gap: 0.85rem; align-items: flex-start; flex: 1;">
                    <span style="font-size: 1.4rem;">${icon}</span>
                    <div>
                      <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                        <strong style="color: var(--rit-navy); font-size: 0.98rem;">${n.title || 'System Notification'}</strong>
                        ${isUnread ? `<span style="background: var(--rit-blue); width: 8px; height: 8px; border-radius: 50%; display: inline-block;" title="Unread"></span>` : ''}
                        <span class="badge badge-applied" style="font-size: 0.7rem;">${n.type || n.category || 'System'}</span>
                      </div>
                      <p style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 0.35rem; line-height: 1.4;">
                        ${n.message || n.content}
                      </p>
                      <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 0.4rem;">
                        ${n.created_at ? new Date(n.created_at).toLocaleString() : 'Just now'}
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; gap: 0.5rem; align-items: center;">
                    ${isUnread ? `
                      <button class="btn btn-secondary btn-sm mark-read-item-btn" data-notif-id="${n.id}">
                        Mark as Read
                      </button>
                    ` : `
                      <span style="font-size: 0.78rem; color: var(--text-muted);">Read</span>
                    `}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Bind individual mark as read buttons
      document.querySelectorAll('.mark-read-item-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-notif-id');
          try {
            await window.api.markNotificationRead(id);
            window.toast.success('Notification marked as read');
            window.views.student.renderNotifications();
          } catch (err) {
            window.toast.error(err.message || 'Failed to mark notification as read');
          }
        });
      });
    };

    renderList('ALL');

    // Tab switcher
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const category = tab.getAttribute('data-category');
        renderList(category);
      });
    });

    // Mark all as read button
    document.getElementById('mark-all-read-btn')?.addEventListener('click', async () => {
      try {
        await window.api.markAllNotificationsRead();
        window.toast.success('All notifications marked as read');
        window.views.student.renderNotifications();
      } catch (err) {
        window.toast.error(err.message || 'Failed to mark all notifications as read');
      }
    });

  } catch (err) {
    container.innerHTML = window.components.renderError(err, "window.views.student.renderNotifications()");
  }
};
