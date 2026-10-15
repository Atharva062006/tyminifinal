/**
 * Staff interview schedule: all booked rounds with slot-lease info; complete or cancel (releases the Team A lease).
 */
window.views = window.views || {};
window.views.faculty = window.views.faculty || {};

window.views.faculty.renderInterviews = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const [list, apps, locks] = await Promise.all([
    window.api.getInterviews(),
    window.api.getApplications(),
    window.api.getLocks().catch(() => null),
  ]);
  const byApp = new Map(apps.map(a => [a.application_id, a]));
  const filter = window.__ivFilter = window.__ivFilter || 'SCHEDULED';
  const rows = list.filter(i => filter === 'ALL' || i.status === filter);

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Interview schedule', subtitle: 'Every interview holds an exclusive slot lease, so two candidates can never be booked into the same slot.',
      tags: [['A', 'slot lease manager'], ['C', 'interview records']],
    })}
    <div class="kpi-grid">
      ${window.components.kpi({ label: 'Scheduled', value: list.filter(i => i.status === 'SCHEDULED').length, tone: 'amber' })}
      ${window.components.kpi({ label: 'Completed', value: list.filter(i => i.status === 'COMPLETED').length, tone: 'green' })}
      ${window.components.kpi({ label: 'Active slot leases', value: locks ? (locks.leases || []).length : '—', meta: 'held in Team A', tone: 'purple' })}
    </div>
    ${window.components.tabs([{ id: 'SCHEDULED', label: 'Scheduled' }, { id: 'COMPLETED', label: 'Completed' }, { id: 'CANCELLED', label: 'Cancelled' }, { id: 'ALL', label: 'All' }], filter)}
    <div class="card" style="padding:.5rem;">
    ${window.components.renderDataTable({
      columns: [
        { label: 'When', render: i => `<b>${esc(fmt.dateTime(i.scheduled_at))}</b>` },
        { label: 'Candidate', render: i => { const a = byApp.get(i.application_id) || {}; return `<b>${esc(a.student_name || i.student_id)}</b><br><span class="muted small">${esc(i.student_id)}</span>`; } },
        { label: 'Drive', render: i => `<b>${esc(i.drive_title || '')}</b><br><span class="muted small">${esc(i.company_name || '')}</span>` },
        { label: 'Round', render: i => esc(i.round_name) },
        { label: 'Mode', render: i => (i.location_url ? `<a class="link" href="${esc(i.location_url)}" target="_blank" rel="noopener">${esc(i.mode || 'Online')}</a>` : esc(i.mode || '—')) },
        { label: 'Status', render: i => window.components.renderBadge(i.status) },
        { label: '', render: i => (i.status === 'SCHEDULED' ? `<div class="row-actions"><button class="btn btn-success btn-sm" data-done="${esc(i.interview_id)}">Mark done</button><button class="btn btn-outline-danger btn-sm" data-cancel="${esc(i.interview_id)}">Cancel</button></div>` : '') },
      ],
      rows, emptyMessage: 'No interviews in this view.',
    })}</div>`;

  const refresh = () => window.views.faculty.renderInterviews();
  c.querySelectorAll('[data-tab]').forEach(t => t.addEventListener('click', () => { window.__ivFilter = t.dataset.tab; refresh(); }));
  c.querySelectorAll('[data-done]').forEach(b => b.addEventListener('click', () => window.components.runAction(b, () => window.api.updateInterview(b.dataset.done, 'COMPLETED'), { success: 'Interview marked complete — slot released', refresh })));
  c.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => window.components.confirm({
    title: 'Cancel this interview?', message: 'The slot lease is released and the candidate stays shortlisted.', confirmText: 'Cancel interview', danger: true,
    onConfirm: () => window.components.runAction(null, () => window.api.updateInterview(b.dataset.cancel, 'CANCELLED'), { success: 'Interview cancelled', refresh }),
  })));
};
