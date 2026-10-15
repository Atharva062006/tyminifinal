/**
 * Student: all my applications with status, rank and quick actions (withdraw).
 */
window.views = window.views || {};
window.views.student = window.views.student || {};

const WITHDRAWABLE = ['APPLIED', 'SCREENING', 'RULE_EVALUATED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER_ISSUED', 'WAITLISTED'];

window.views.student.renderApplications = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const apps = await window.api.getApplications();
  const filter = window.__appFilter = window.__appFilter || 'ACTIVE';
  const ended = ['WITHDRAWN', 'REJECTED', 'NOT_ELIGIBLE', 'OFFER_DECLINED', 'EXPIRED'];
  const list = apps.filter(a => filter === 'ALL' || (filter === 'ACTIVE' ? !ended.includes(a.state) : ended.includes(a.state)));

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'My applications', subtitle: 'Track every application from submission to offer.',
      tags: [['C', 'application state machine'], ['A', 'eligibility'], ['B', 'rank']],
      actions: '<a class="btn btn-primary" href="#/student/drives">Apply to a drive</a>',
    })}
    ${window.components.tabs([{ id: 'ACTIVE', label: 'In progress' }, { id: 'ENDED', label: 'Closed' }, { id: 'ALL', label: 'All' }], filter)}
    ${list.length ? window.components.renderDataTable({
      columns: [
        { label: 'Drive', render: a => `<b>${esc(a.drive_title)}</b><br><span class="muted small">${esc(a.company_name)} · ${esc(fmt.money(a.package))}</span>` },
        { label: 'Status', render: a => `${window.components.renderBadge(a.state)}${a.pipeline_status === 'EVALUATION_PENDING' ? '<br><span class="chip amber" style="margin-top:.25rem;">evaluation pending</span>' : ''}` },
        { label: 'Eligibility', render: a => (a.eligibility_result ? window.components.renderEligibilityBadge(a.eligibility_result) : '<span class="muted">—</span>') },
        { label: 'Rank', render: a => (a.rank ? `<span class="rank-no ${a.rank <= 3 ? 'top' : ''}">${a.rank}</span> <span class="muted small">of ${esc(a.rank_pool)}</span>` : (a.ranking_status === 'DEGRADED' ? '<span class="chip amber">pending</span>' : '<span class="muted">—</span>')) },
        { label: 'Applied', render: a => esc(fmt.date(a.created_at)) },
        { label: '', render: a => `<div class="row-actions"><a class="btn btn-secondary btn-sm" href="#/student/applications/${esc(a.application_id)}">Details</a>${WITHDRAWABLE.includes(a.state) ? `<button class="btn btn-outline-danger btn-sm" data-withdraw="${esc(a.application_id)}">Withdraw</button>` : ''}</div>` },
      ],
      rows: list, emptyMessage: 'Nothing here.',
    }) : window.components.emptyState(filter === 'ENDED' ? 'No closed applications' : 'No applications in progress', 'When you apply to a drive it shows up here with live status.', '<a class="btn btn-primary btn-sm" href="#/student/drives">Browse drives</a>')}`;

  c.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { window.__appFilter = b.dataset.tab; window.views.student.renderApplications(); }));
  c.querySelectorAll('[data-withdraw]').forEach(b => b.addEventListener('click', () => {
    window.components.confirm({
      title: 'Withdraw application?', message: 'This releases your seat and any reserved interview slot. You can apply again later if the drive is still open.',
      confirmText: 'Withdraw', danger: true,
      onConfirm: () => window.components.runAction(null, () => window.api.withdrawApplication(b.dataset.withdraw), { success: 'Application withdrawn', refresh: () => window.views.student.renderApplications() }),
    });
  }));
};
