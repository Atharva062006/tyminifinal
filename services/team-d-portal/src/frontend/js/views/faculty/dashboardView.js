/**
 * Staff operations dashboard: what needs attention, pipeline, drives and engine telemetry.
 * Shared by faculty/TPO and (extended) the admin dashboard.
 */
window.views = window.views || {};
window.views.faculty = window.views.faculty || {};

window.views.faculty._opsBlocks = function (d, base) {
  const k = d.kpis || {};
  const tA = d.telemetry?.team_a || {};
  const tB = d.telemetry?.team_b || {};
  return {
    kpis: `
      <div class="kpi-grid">
        ${window.components.kpi({ label: 'Needs review', value: k.pending_review, tone: k.pending_review ? 'amber' : '', meta: 'eligible, awaiting decision' })}
        ${window.components.kpi({ label: 'Applications', value: k.total_applications, meta: 'across all drives' })}
        ${window.components.kpi({ label: 'Shortlisted', value: k.shortlisted, tone: 'purple' })}
        ${window.components.kpi({ label: 'Interviews', value: k.interviews_scheduled, tone: 'cyan' })}
        ${window.components.kpi({ label: 'Offers', value: (k.offers_issued || 0) + (k.offers_accepted || 0), tone: 'green', meta: `${k.offers_accepted || 0} accepted` })}
        ${k.stalled_pipeline ? window.components.kpi({ label: 'Engine pending', value: k.stalled_pipeline, tone: 'rose', meta: 'waiting for Team A' }) : ''}
      </div>`,
    pending: `
      <div class="card"><div class="card-head"><h3>Awaiting your decision</h3><a class="link small" href="${base}/applications">Open review queue →</a></div>
        ${(d.pending_review || []).length ? d.pending_review.map(a => `<div class="list-item"><div class="row" style="flex-wrap:nowrap;"><span class="rank-no ${a.rank && a.rank <= 3 ? 'top' : ''}">${esc(a.rank || '–')}</span><div><b>${esc(a.student_name || a.student_id)}</b><div class="muted small">${esc(a.drive_title)} · ${window.components.renderEligibilityBadge(a.eligibility_result)}</div></div></div><a class="btn btn-secondary btn-sm" href="${base}/applications">Review</a></div>`).join('') : window.components.emptyState('Queue is clear', 'No applications are waiting for review.')}
      </div>`,
    funnel: window.components.renderFunnelChart(d.pipeline_distribution),
    drives: `
      <div class="card"><div class="card-head"><h3>Drives &amp; seats</h3><a class="link small" href="${base}/drives">Manage →</a></div>
        ${(d.drives_summary || []).map(x => `<div class="list-item" style="display:block;"><div class="row between"><div><b>${esc(x.title)}</b> <span class="muted small">${esc(x.company_name)}</span></div><span class="badge badge-${esc(String(x.state).toLowerCase())}">${esc(x.state)}</span></div>
          <div class="row between small muted" style="margin-top:.3rem;"><span>${esc(x.applications_count)} applicants · ${esc(x.pending_review)} to review</span><span>${esc(x.remaining_seats)} / ${esc(x.total_seats)} seats left</span></div>
          <div class="seat-bar" style="margin-top:.3rem;"><div style="width:${Math.round(((x.total_seats - x.remaining_seats) / Math.max(x.total_seats, 1)) * 100)}%"></div></div></div>`).join('') || '<p class="sub">No drives yet.</p>'}
      </div>`,
    interviews: `
      <div class="card"><div class="card-head"><h3>Upcoming interviews</h3><a class="link small" href="${base}/interviews">Schedule →</a></div>
        ${(d.upcoming_interviews || []).map(i => `<div class="list-item"><div><b>${esc(i.student_name || i.student_id)}</b><div class="muted small">${esc(i.round_name)} · ${esc(i.drive_title || '')}</div></div><b class="small">${esc(fmt.dateTime(i.scheduled_at))}</b></div>`).join('') || '<p class="sub">No interviews scheduled.</p>'}
      </div>`,
    telemetry: `
      <div class="grid cols-2">
        <div class="card"><div class="card-head"><h3>Eligibility engine</h3>${window.components.teamTag('A')}</div>
          <dl class="kv small"><dt>Queue policy</dt><dd>${esc(tA.queue_policy || '—')}</dd><dt>Queue depth</dt><dd>${esc(tA.queue_depth ?? '—')}</dd><dt>p95 decision</dt><dd>${esc(tA.p95_decision_latency_ms ?? '—')} ms</dd><dt>Active leases</dt><dd>${esc(tA.active_leases ?? '—')}</dd><dt>Deadlocks resolved</dt><dd>${esc(tA.deadlocks_resolved ?? tA.deadlocks_detected ?? 0)}</dd></dl></div>
        <div class="card"><div class="card-head"><h3>Ranking engine</h3>${window.components.teamTag('B')}</div>
          <dl class="kv small"><dt>Graph version</dt><dd>${esc(tB.graph_version || '—')}</dd><dt>p95 ranking</dt><dd>${esc(tB.p95_ranking_latency_ms ?? '—')} ms</dd><dt>Cache hit rate</dt><dd>${esc(tB.cache_hit_rate_pct ?? '—')}%</dd><dt>Profiles</dt><dd>${esc(tB.graph?.students ?? '—')} students / ${esc(tB.graph?.drives ?? '—')} drives</dd></dl></div>
      </div>`,
    announcements: `
      <div class="card"><div class="card-head"><h3>Latest announcements</h3><a class="link small" href="${base}/announcements">Manage →</a></div>
        ${(d.announcements || []).map(a => `<div class="list-item" style="display:block;"><b>${esc(a.title)}</b><div class="muted small">${esc(fmt.ago(a.created_at))}</div></div>`).join('') || '<p class="sub">None yet.</p>'}
      </div>`,
  };
};

window.views.faculty.renderDashboard = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const user = window.store.get('user');
  const d = await window.api.getDashboard();
  const b = window.views.faculty._opsBlocks(d, '#/faculty');
  c.innerHTML = `
    ${window.components.pageHeader({
      title: `Placement operations`, subtitle: `Welcome, ${user.name}. Here is what needs attention today.`,
      tags: [['C', 'live data'], ['A', 'queue telemetry'], ['B', 'ranking telemetry']],
      actions: '<a class="btn btn-primary btn-sm" href="#/faculty/applications">Review applications</a><a class="btn btn-secondary btn-sm" href="#/faculty/drives">Manage drives</a>',
    })}
    ${b.kpis}
    <div class="grid split">
      <div class="stack">${b.pending}${b.drives}${b.telemetry}</div>
      <div class="stack">${b.funnel}${b.interviews}${b.announcements}</div>
    </div>`;
};
