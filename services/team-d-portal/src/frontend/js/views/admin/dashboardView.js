/**
 * Admin / auditor control centre: operations blocks plus platform health, users, reconciliation and audit feed.
 */
window.views = window.views || {};
window.views.admin = window.views.admin || {};

window.views.admin.renderDashboard = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const user = window.store.get('user');
  const d = await window.api.getDashboard();
  const b = window.views.faculty._opsBlocks(d, '#/admin');
  const h = d.system_health || {};
  const rec = d.reconciliation;
  const us = d.user_summary || {};
  const audit = Array.isArray(d.recent_audit_events) ? d.recent_audit_events : (d.recent_audit_events?.entries || []);
  const svc = (name, team, s) => `<div class="list-item"><div class="row">${window.components.teamTag(team)}<b>${esc(name)}</b></div><span class="mode-badge ${s?.status === 'ONLINE' ? 'mode-LIVE' : 'mode-DOWN'}">${esc(s?.status || 'UNKNOWN')}${s?.fallback ? ' · fallback' : ''}</span></div>`;

  c.innerHTML = `
    ${window.components.pageHeader({
      title: user.role === 'auditor' ? 'Audit overview' : 'Control centre', subtitle: 'Platform health, data integrity and what is happening across the placement season.',
      tags: [['C', 'audit & reconciliation'], ['D', 'portal'], ['A', 'health'], ['B', 'health']],
      actions: user.role === 'admin' ? '<a class="btn btn-primary btn-sm" href="#/admin/users">Manage users</a><a class="btn btn-secondary btn-sm" href="#/admin/system">System &amp; engines</a>' : '<a class="btn btn-primary btn-sm" href="#/admin/audit">Open audit log</a>',
    })}
    ${b.kpis}
    <div class="grid split">
      <div class="stack">
        ${user.role === 'admin' ? b.pending : ''}
        ${b.drives}
        <div class="card"><div class="card-head"><h3>Recent audit events</h3><a class="link small" href="#/admin/audit">Full log →</a></div>
          ${audit.length ? audit.map(e => `<div class="list-item small"><div><b>${esc(e.action)}</b><div class="muted">${esc(e.table_name)} · ${esc(String(e.record_id).slice(0, 18))} · by ${esc(e.actor)}</div></div><span class="muted">${esc(fmt.ago(e.timestamp))}</span></div>`).join('') : '<p class="sub">No audit events.</p>'}
        </div>
      </div>
      <div class="stack">
        <div class="card"><div class="card-head"><h3>Service health</h3><a class="link small" href="#/admin/system">Details</a></div>
          ${svc('Eligibility engine', 'A', h.team_a)}${svc('Ranking engine', 'B', h.team_b)}${svc('Placement database', 'C', h.team_c)}${svc('Portal / BFF', 'D', h.team_d)}
        </div>
        <div class="card"><div class="card-head"><h3>Data integrity</h3>${window.components.teamTag('C', 'reconciliation')}</div>
          ${rec ? `<div class="alert ${rec.consistent ? 'ok' : 'error'}" style="margin:0;"><div><b>${rec.consistent ? 'All consistent' : 'Inconsistency detected'}</b><div class="small">${esc(rec.checked_applications)} applications checked · seats and eligibility decisions reconciled</div></div></div>` : '<p class="sub">Reconciliation unavailable.</p>'}
        </div>
        <div class="card"><div class="card-head"><h3>Accounts</h3></div>
          <dl class="kv"><dt>Total users</dt><dd><b>${esc(us.total ?? '—')}</b></dd>${Object.entries(us.by_role || {}).map(([r, n]) => `<dt style="text-transform:capitalize;">${esc(r)}</dt><dd>${esc(n)}</dd>`).join('')}<dt>Deactivated</dt><dd>${esc(us.inactive ?? 0)}</dd></dl>
        </div>
        ${b.funnel}
      </div>
    </div>`;
};
