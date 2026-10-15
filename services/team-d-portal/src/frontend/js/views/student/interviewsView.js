/**
 * Student interviews: upcoming and past rounds with join links.
 */
window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderInterviews = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const list = await window.api.getInterviews();
  const now = Date.now();
  const upcoming = list.filter(i => i.status === 'SCHEDULED' && new Date(i.scheduled_at).getTime() >= now - 3600000);
  const past = list.filter(i => !upcoming.includes(i));

  const card = (i) => `
    <div class="card" style="border-left:4px solid ${i.status === 'SCHEDULED' ? 'var(--rit-blue)' : '#cbd5e1'};">
      <div class="row between"><div><h3 style="font-size:1.02rem;">${esc(i.round_name)}</h3><div class="muted small">${esc(i.company_name || '')} · ${esc(i.drive_title || '')}</div></div>${window.components.renderBadge(i.status)}</div>
      <dl class="kv" style="margin-top:.8rem;">
        <dt>When</dt><dd><b>${esc(fmt.dateTime(i.scheduled_at))}</b></dd>
        <dt>Mode</dt><dd>${esc(i.mode || 'Online')}</dd>
        <dt>Link</dt><dd>${i.location_url ? `<a class="link" href="${esc(i.location_url)}" target="_blank" rel="noopener">Join interview</a>` : '—'}</dd>
        <dt>Application</dt><dd><a class="link" href="#/student/applications/${esc(i.application_id)}">View</a></dd>
      </dl>
    </div>`;

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Interviews', subtitle: 'Your interview slots are reserved exclusively for you — no two candidates can hold the same slot.',
      tags: [['A', 'exclusive slot leases'], ['C', 'schedule records']],
    })}
    <h3 style="margin-bottom:.7rem;">Upcoming (${upcoming.length})</h3>
    ${upcoming.length ? `<div class="grid cols-2">${upcoming.map(card).join('')}</div>` : window.components.emptyState('No upcoming interviews', 'When the placement cell schedules an interview you will be notified here and by notification.')}
    ${past.length ? `<h3 style="margin:1.5rem 0 .7rem;">Past &amp; cancelled</h3><div class="grid cols-2">${past.map(card).join('')}</div>` : ''}`;
};
