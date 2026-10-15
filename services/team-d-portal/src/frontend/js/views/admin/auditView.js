/**
 * Immutable audit trail viewer (admin + auditor): filter by actor, table, record, correlation id, date.
 */
window.views = window.views || {};
window.views.admin = window.views.admin || {};

window.views.admin.renderAudit = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const f = window.__audF = window.__audF || { actor: '', table_name: '', record_id: '', correlation_id: '', from_date: '', to_date: '', limit: 100 };
  const filters = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
  if (filters.from_date) filters.from_date = new Date(filters.from_date).toISOString();
  if (filters.to_date) filters.to_date = new Date(filters.to_date + 'T23:59:59').toISOString();
  const data = await window.api.getAuditLogs(filters);
  const entries = data.entries || data.records || [];

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Audit log', subtitle: `Append-only record of every create, update and state change — ${data.total ?? entries.length} matching entries.`,
      tags: [['C', 'audit & B-tree indexes'], ['D', 'correlation search']],
    })}
    <form id="au-form" class="filter-bar" novalidate>
      <input name="actor" class="form-control" placeholder="Actor (e.g. FAC001)" value="${esc(f.actor)}" aria-label="Actor"/>
      <select name="table_name" class="form-control" aria-label="Table"><option value="">Any table</option>${['applications', 'students', 'users', 'interviews', 'announcements', 'offers'].map(t => `<option ${f.table_name === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <input name="record_id" class="form-control" placeholder="Record ID" value="${esc(f.record_id)}" aria-label="Record ID"/>
      <input name="correlation_id" class="form-control" placeholder="Correlation ID" value="${esc(f.correlation_id)}" aria-label="Correlation ID"/>
      <input name="from_date" type="date" class="form-control" value="${esc(f.from_date)}" aria-label="From date"/>
      <input name="to_date" type="date" class="form-control" value="${esc(f.to_date)}" aria-label="To date"/>
      <button class="btn btn-primary btn-sm" type="submit">Search</button><button class="btn btn-ghost btn-sm" type="button" id="au-clear">Clear</button>
    </form>
    <div class="card" style="padding:.5rem;">
      ${window.components.renderDataTable({
        columns: [
          { label: 'Time', render: e => `<span class="small">${esc(fmt.dateTime(e.timestamp))}</span>` },
          { label: 'Actor', render: e => `<b>${esc(e.actor)}</b>` },
          { label: 'Action', render: e => `<span class="small">${esc(e.action)}</span>` },
          { label: 'Record', render: e => `<span class="mono small">${esc(e.table_name)}/${esc(String(e.record_id).slice(0, 14))}</span>` },
          { label: 'Correlation', render: e => (e.correlation_id ? `<button class="link mono small" data-corr="${esc(e.correlation_id)}">${esc(String(e.correlation_id).slice(0, 8))}…</button>` : '—') },
          { label: 'Change', render: e => `<button class="link small" data-diff="${esc(e.audit_id)}">before / after</button>` },
        ],
        rows: entries, emptyMessage: 'No audit entries match these filters.',
      })}
    </div>`;

  document.getElementById('au-form').addEventListener('submit', (e) => {
    e.preventDefault();
    for (const [k, v] of new FormData(e.target).entries()) f[k] = String(v).trim();
    window.views.admin.renderAudit();
  });
  document.getElementById('au-clear').addEventListener('click', () => { Object.keys(f).forEach(k => { if (k !== 'limit') f[k] = ''; }); window.views.admin.renderAudit(); });
  c.querySelectorAll('[data-corr]').forEach(b => b.addEventListener('click', () => { Object.keys(f).forEach(k => { if (k !== 'limit') f[k] = ''; }); f.correlation_id = b.dataset.corr; window.views.admin.renderAudit(); }));
  c.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', () => {
    const e = entries.find(x => x.audit_id === b.dataset.diff);
    window.modal.open({
      title: e.action,
      contentHtml: `<p class="small muted">${esc(fmt.dateTime(e.timestamp))} · by ${esc(e.actor)} · correlation <span class="mono">${esc(e.correlation_id || '—')}</span></p>
        <div class="grid cols-2"><div><b class="small">Before</b><pre class="code">${esc(JSON.stringify(e.before_value, null, 2) || 'null')}</pre></div><div><b class="small">After</b><pre class="code">${esc(JSON.stringify(e.after_value, null, 2) || 'null')}</pre></div></div>`,
      buttons: [{ text: 'Close', className: 'btn-secondary', onClick: () => true }],
    });
  }));
};
