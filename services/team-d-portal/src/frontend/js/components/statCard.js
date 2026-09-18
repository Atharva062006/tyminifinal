/**
 * KPI Stat Card renderer for Team D Dashboards.
 */

window.components = window.components || {};

window.components.renderStatCard = function({ label, value, metaText = '', trend = null }) {
  let trendHtml = '';
  if (trend === 'up') trendHtml = '<span style="color: var(--accent-emerald);">Positive</span>';
  else if (trend === 'down') trendHtml = '<span style="color: var(--accent-rose);">Attention</span>';

  return `
    <div class="stat-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div class="stat-label">${label}</div>
      </div>
      <div class="stat-value">${value !== undefined && value !== null ? value : 0}</div>
      ${(metaText || trendHtml) ? `
        <div class="stat-meta">
          ${trendHtml} ${metaText ? `<span>${metaText}</span>` : ''}
        </div>
      ` : ''}
    </div>
  `;
};
