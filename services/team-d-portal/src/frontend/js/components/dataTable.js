/**
 * Accessible Data Table Renderer for Team D.
 */

window.components = window.components || {};

window.components.renderDataTable = function({ columns = [], rows = [], emptyMessage = 'No records found', onRowClick = null }) {
  if (!rows || rows.length === 0) {
    return `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
        <p>${emptyMessage}</p>
      </div>
    `;
  }

  const thHtml = columns.map(col => `<th scope="col" style="${col.style || ''}">${col.label}</th>`).join('');

  const trHtml = rows.map((row, idx) => {
    const tdHtml = columns.map(col => {
      let cellValue = '';
      if (typeof col.render === 'function') {
        cellValue = col.render(row, idx);
      } else {
        cellValue = row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '—';
      }
      return `<td data-label="${col.label}">${cellValue}</td>`;
    }).join('');

    return `<tr data-row-id="${row.id || row.application_id || row.drive_id || idx}">${tdHtml}</tr>`;
  }).join('');

  return `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>${thHtml}</tr>
        </thead>
        <tbody>
          ${trHtml}
        </tbody>
      </table>
    </div>
  `;
};
