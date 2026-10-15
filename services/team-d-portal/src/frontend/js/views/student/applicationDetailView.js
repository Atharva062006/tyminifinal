/**
 * Application detail: stepper, eligibility decision, ranking, interviews, offer, traceability and audit trail.
 * Used by students (own application) and linked from staff screens.
 */
window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderApplicationDetail = async function (applicationId) {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const d = await window.api.getApplication(applicationId);
  const app = d.application;
  const drive = d.drive || {};
  const company = drive.company || {};
  const decision = (d.decisions || [])[0];
  const r = d.ranking;
  const role = window.store.get('user').role;
  const canWithdraw = role === 'student' && ['APPLIED', 'SCREENING', 'RULE_EVALUATED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER_ISSUED', 'WAITLISTED'].includes(app.state);
  const offer = (d.offers || []).find(o => ['COMMITTED', 'ACCEPTED', 'DECLINED'].includes(o.status));

  const stalled = app.pipeline_status === 'EVALUATION_PENDING';
  c.innerHTML = `
    ${window.components.pageHeader({
      title: drive.title || 'Application', subtitle: `${company.name || ''} · applied ${fmt.dateTime(app.created_at)}`,
      crumbs: [{ label: 'Applications', href: role === 'student' ? '#/student/applications' : '#/faculty/applications' }, { label: drive.title || applicationId }],
      tags: [['C', 'state & audit'], ['A', 'decision'], ['B', 'ranking']],
      actions: `${window.components.renderBadge(app.state)} ${canWithdraw ? '<button class="btn btn-outline-danger btn-sm" id="withdraw-btn">Withdraw</button>' : ''}`,
    })}
    ${stalled ? `<div class="alert warn"><div><b>Evaluation pending.</b> The eligibility engine was unreachable when you applied. Your application is saved and will be evaluated automatically.${role !== 'student' ? ' <button class="link" id="reeval-btn">Retry now</button>' : ''}</div></div>` : ''}
    ${app.ranking_status === 'DEGRADED' ? `<div class="alert info"><div><b>Ranking delayed.</b> The ranking engine was unavailable; your application is valid and will be ranked shortly.${role !== 'student' ? ' <button class="link" id="reeval-btn">Retry ranking</button>' : ''}</div></div>` : ''}

    <div class="card"><div class="card-head"><h3>Progress</h3><span class="small muted">Last update ${esc(fmt.ago(app.updated_at))}</span></div>
      ${window.components.renderTimeline(d.timeline)}
      ${['NOT_ELIGIBLE', 'REJECTED', 'WAITLISTED', 'WITHDRAWN', 'OFFER_DECLINED'].includes(app.state) ? `<div class="alert ${app.state === 'WAITLISTED' ? 'warn' : 'error'}" style="margin:.5rem 0 0;"><div><b>${esc(app.state.replace(/_/g, ' '))}</b>${app.status_reason ? ` — ${esc(app.status_reason)}` : ''}${app.state === 'NOT_ELIGIBLE' && (app.failed_rules || []).length ? `<ul style="margin:.3rem 0 0 1.1rem;">${app.failed_rules.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}</div></div>` : ''}
    </div>

    <div class="grid cols-2" style="margin-top:1.25rem;">
      <div class="stack">
        <div class="card"><div class="card-head"><h3>Eligibility decision</h3>${window.components.teamTag('A', 'rule engine')}</div>
          ${decision ? `
            ${(decision.criteria_breakdown || []).length ? window.components.eligibilityBreakdown({ eligibility_result: decision.result, criteria_breakdown: decision.criteria_breakdown, failed_rules: decision.failed_rules, strategy: decision.strategy, rule_set_version: decision.rule_set_version, decision_metrics: decision.metrics }) : `<p class="sub">${(decision.failed_rules || []).length ? esc(decision.failed_rules.join('; ')) : 'All rules satisfied.'}</p>`}`
            : '<p class="sub">No decision recorded yet.</p>'}
        </div>
        <div class="card"><div class="card-head"><h3>Interviews</h3>${window.components.teamTag('A', 'slot lease')}</div>
          ${(d.interviews || []).length ? d.interviews.map(i => `<div class="list-item"><div><b>${esc(i.round_name)}</b><div class="muted small">${esc(i.mode || '')} ${i.location_url ? `· <a class="link" href="${esc(i.location_url)}" target="_blank" rel="noopener">join link</a>` : ''}</div></div><div class="right small"><b>${esc(fmt.dateTime(i.scheduled_at))}</b><br>${window.components.renderBadge(i.status)}</div></div>`).join('') : '<p class="sub">No interviews scheduled yet.</p>'}
        </div>
        ${offer ? `<div class="card" style="border-top:3px solid var(--accent-emerald);"><div class="card-head"><h3>Offer</h3>${window.components.renderBadge(offer.status)}</div>
          <dl class="kv"><dt>Package</dt><dd><b>${esc(fmt.money(offer.package_ctc))}</b></dd><dt>Role</dt><dd>${esc(offer.role_title || drive.title)}</dd><dt>Joining</dt><dd>${esc(offer.joining_date ? fmt.date(offer.joining_date) : 'To be confirmed')}</dd></dl>
          ${role === 'student' && offer.status === 'COMMITTED' ? '<p style="margin-top:1rem;"><a class="btn btn-success btn-sm" href="#/student/offers">Respond to offer</a></p>' : ''}</div>` : ''}
      </div>

      <div class="stack">
        <div class="card"><div class="card-head"><h3>Ranking</h3>${window.components.teamTag('B', 'skill-graph score')}</div>
          ${r && r.rank ? `
            <div class="row" style="gap:1rem;"><span class="rank-no top" style="width:46px;height:46px;font-size:1.15rem;">${esc(r.rank)}</span><div><b>Rank ${esc(r.rank)} of ${esc(r.pool ?? '—')} eligible applicants</b><div class="muted small">Score ${esc(fmt.num(r.total_score, 3))} · ${esc(String(r.algorithm || '').replace(/_/g, ' '))} · graph ${esc(r.graph_version || '—')}${r.stale ? ' · <span style="color:var(--accent-amber)">profiles changed since</span>' : ''}</div></div></div>
            ${r.score_breakdown ? `<div style="margin-top:1rem;">${Object.entries(r.score_breakdown).map(([k, v]) => `<div class="row between small"><span>${esc(k.replace(/_/g, ' '))}</span><b>${esc(fmt.num(v, 3))}</b></div><div class="score-bar" style="margin-bottom:.45rem;"><div style="width:${Math.min(100, v * 250)}%"></div></div>`).join('')}</div>` : ''}
            ${(r.missing_skills || []).length ? `<p class="small" style="margin-top:.6rem;">Skills to add: ${r.missing_skills.map(s => `<span class="chip amber">${esc(s)}</span>`).join(' ')}</p>` : ''}`
            : '<p class="sub">You will be ranked once your eligibility is confirmed.</p>'}
        </div>
        <div class="card"><div class="card-head"><h3>Traceability</h3>${window.components.teamTag('C', 'audit')}</div>
          <dl class="kv small">
            <dt>Application ID</dt><dd class="mono">${esc(d.traceability.application_id)}</dd>
            <dt>Version</dt><dd>${esc(d.traceability.version)}</dd>
            <dt>Idempotency key</dt><dd class="mono">${esc(d.traceability.idempotency_key)}</dd>
            <dt>Decision ID</dt><dd class="mono">${esc(d.traceability.decision_id || '—')}</dd>
            <dt>Ranking ID</dt><dd class="mono">${esc(d.traceability.ranking_id || '—')}</dd>
          </dl>
          <details style="margin-top:.8rem;"><summary class="link small">Audit trail (${(d.audit_trail || []).length})</summary>
            <div style="margin-top:.5rem;">${(d.audit_trail || []).map(a => `<div class="list-item small"><div><b>${esc(a.action)}</b><div class="muted">by ${esc(a.actor)}</div></div><span class="muted">${esc(fmt.dateTime(a.timestamp))}</span></div>`).join('')}</div></details>
        </div>
      </div>
    </div>`;

  document.getElementById('withdraw-btn')?.addEventListener('click', () => window.components.confirm({
    title: 'Withdraw application?', message: 'This releases your seat and any reserved interview slot.', confirmText: 'Withdraw', danger: true,
    onConfirm: () => window.components.runAction(null, () => window.api.withdrawApplication(applicationId), { success: 'Application withdrawn', refresh: () => window.views.student.renderApplicationDetail(applicationId) }),
  }));
  document.getElementById('reeval-btn')?.addEventListener('click', (e) => window.components.runAction(e.currentTarget, () => window.api.reevaluate(applicationId), { success: 'Re-evaluation complete', refresh: () => window.views.student.renderApplicationDetail(applicationId) }));
};
