/**
 * Admin Immutable Audit Trail View for Team D Frontend.
 * Clean RIT Institutional Design Theme.
 */

window.views = window.views || {};
window.views.admin = window.views.admin || {};

window.views.admin.renderAudit = async function() {
  const container = document.getElementById('main-content');
  container.innerHTML = window.components.renderLoading('Querying append-only audit trail from Team C DBMS...');

  try {
    const auditResponse = await window.api.getAuditLogs({ limit: 100 });
    const records = Array.isArray(auditResponse)
      ? auditResponse
      : (auditResponse.entries || auditResponse.records || []);

    container.innerHTML = `
      <!-- Breadcrumb -->
      <div id="breadcrumb-bar" style="margin-bottom: 1.25rem;">
        <span style="color: var(--text-muted);">Home</span> / <a href="#/admin/dashboard" style="color: var(--text-muted); text-decoration: none;">Admin</a> / <strong style="color: var(--rit-navy);">Audit Logs</strong>
      </div>

      <!-- Page Header -->
      <div style="margin-bottom: 1.75rem;">
        <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--rit-navy); margin-bottom: 0.25rem;">Immutable Placement Audit Trail</h1>
        <p style="color: var(--text-secondary); font-size: 0.92rem;">Cryptographically verified append-only audit log stored in Team C DBMS Engine.</p>
      </div>

      <!-- Filter Controls -->
      <div class="card" style="margin-bottom: 1.5rem; background: #ffffff;">
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
          <div style="flex: 1; min-width: 240px;">
            <input type="text" id="audit-search-input" class="form-control" placeholder="Search by User, Action, Resource, or Correlation ID..." />
          </div>
          <button id="audit-refresh-btn" class="btn btn-secondary btn-sm">Refresh Logs</button>
        </div>
      </div>

      <!-- Audit Table Container -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Audit Log Entries (<span id="audit-count">${records.length}</span>)</h3>
          <span class="badge badge-selected">C4 Audit Compliance</span>
        </div>
        <div id="audit-table-container"></div>
      </div>
    `;

    const searchInput = document.getElementById('audit-search-input');
    const tableContainer = document.getElementById('audit-table-container');

    const renderTable = (items) => {
      tableContainer.innerHTML = window.components.renderDataTable({
        columns: [
          {
            label: 'Timestamp (UTC)',
            render: r => `<span style="font-size: 0.75rem; color: var(--text-muted); font-family: 'JetBrains Mono';">${r.timestamp ? new Date(r.timestamp).toLocaleString() : '—'}</span>`
          },
          {
            label: 'User / Actor',
            render: r => `<strong style="color: var(--rit-navy);">${r.actor || r.user || 'System'}</strong>`
          },
          {
            label: 'Role',
            render: r => `<span class="mono" style="font-size: 0.75rem; color: var(--text-secondary);">${(r.role || 'system').toUpperCase()}</span>`
          },
          {
            label: 'Action',
            render: r => `<span class="badge badge-applied">${r.action || 'MUTATION'}</span>`
          },
          {
            label: 'Resource',
            render: r => `<span class="mono" style="font-size: 0.8rem;">${r.table_name || r.resource || 'record'}</span>`
          },
          {
            label: 'Status',
            render: r => `<span class="badge badge-selected">${r.status || 'SUCCESS'}</span>`
          },
          {
            label: 'Correlation ID',
            render: r => `<span class="mono" style="font-size: 0.7rem; color: var(--rit-blue);" title="${r.correlation_id}">${r.correlation_id ? r.correlation_id.substring(0, 14) + '...' : '—'}</span>`
          }
        ],
        rows: items,
        emptyMessage: 'No audit records match search query.'
      });
    };

    renderTable(records);

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderTable(records);
        return;
      }

      const filtered = records.filter(r => 
        (r.actor || '').toLowerCase().includes(q) ||
        (r.action || '').toLowerCase().includes(q) ||
        (r.table_name || '').toLowerCase().includes(q) ||
        (r.correlation_id || '').toLowerCase().includes(q)
      );

      document.getElementById('audit-count').textContent = filtered.length;
      renderTable(filtered);
    });

    document.getElementById('audit-refresh-btn')?.addEventListener('click', () => {
      window.views.admin.renderAudit();
    });

  } catch (err) {
    container.innerHTML = window.components.renderError(err, "window.views.admin.renderAudit()");
  }
};
