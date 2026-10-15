/**
 * Staff announcements: post notices (fan out as notifications to students) and remove old ones.
 */
window.views = window.views || {};
window.views.faculty = window.views.faculty || {};

window.views.faculty.renderAnnouncements = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const list = await window.api.getAnnouncements();

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Announcements', subtitle: 'Posting a notice also sends a notification to every active student.',
      tags: [['C', 'announcements & notifications'], ['D', 'live delivery']],
    })}
    <div class="grid split">
      <div class="card"><div class="card-head"><h3>Published (${list.length})</h3></div>
        ${list.map(a => `<div class="list-item"><div><b>${esc(a.title)}</b><div class="sub small">${esc(a.content)}</div><div class="muted small">${esc(fmt.dateTime(a.created_at))} · ${esc(a.author)}</div></div><button class="btn btn-outline-danger btn-sm" data-del="${esc(a.announcement_id)}">Delete</button></div>`).join('') || window.components.emptyState('No announcements', 'Post the first one using the form.')}
      </div>
      <form id="ann-form" class="card" novalidate>
        <div class="card-head"><h3>New announcement</h3></div>
        <div class="form-group" style="margin-bottom:.8rem;"><label for="an-title">Title *</label><input id="an-title" class="form-control" maxlength="120"/></div>
        <div class="form-group" style="margin-bottom:.8rem;"><label for="an-body">Message</label><textarea id="an-body" class="form-control" maxlength="1000" placeholder="Details, venue, deadlines…"></textarea></div>
        <div id="an-err" class="form-error" role="alert"></div>
        <button class="btn btn-primary" type="submit">Publish &amp; notify students</button>
      </form>
    </div>`;

  document.getElementById('ann-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('an-title').value.trim();
    if (!title) { document.getElementById('an-err').textContent = 'Title is required.'; return; }
    await window.components.runAction(e.submitter, () => window.api.createAnnouncement({ title, content: document.getElementById('an-body').value.trim() }), { success: 'Announcement published', refresh: () => window.views.faculty.renderAnnouncements() });
  });
  c.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => window.components.confirm({
    title: 'Delete announcement?', message: 'This removes it for everyone. Notifications already sent stay in inboxes.', confirmText: 'Delete', danger: true,
    onConfirm: () => window.components.runAction(null, () => window.api.deleteAnnouncement(b.dataset.del), { success: 'Deleted', refresh: () => window.views.faculty.renderAnnouncements() }),
  })));
};
