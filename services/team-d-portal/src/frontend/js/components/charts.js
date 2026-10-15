/**
 * Lightweight Vanilla SVG Chart Generators for Team D Frontend.
 * Implements pure SVG charts without external NPM dependencies.
 */

window.components = window.components || {};

/**
 * Renders an SVG Funnel Chart representing the placement pipeline
 */
window.components.renderFunnelChart = function(counts = {}) {
  const stages = [
    { label: 'Applied', key: 'APPLIED', count: (counts.APPLIED || 0) + (counts.SCREENING || 0) + (counts.RULE_EVALUATED || 0) + (counts.SHORTLISTED || 0) + (counts.INTERVIEW_SCHEDULED || 0) + (counts.SELECTED || 0) + (counts.OFFER_ISSUED || 0) + (counts.OFFER_ACCEPTED || 0) + (counts.OFFER_DECLINED || 0), color: '#38bdf8' },
    { label: 'Evaluated', key: 'RULE_EVALUATED', count: (counts.RULE_EVALUATED || 0) + (counts.SHORTLISTED || 0) + (counts.INTERVIEW_SCHEDULED || 0) + (counts.SELECTED || 0) + (counts.OFFER_ISSUED || 0) + (counts.OFFER_ACCEPTED || 0) + (counts.OFFER_DECLINED || 0), color: '#818cf8' },
    { label: 'Shortlisted', key: 'SHORTLISTED', count: (counts.SHORTLISTED || 0) + (counts.INTERVIEW_SCHEDULED || 0) + (counts.SELECTED || 0) + (counts.OFFER_ISSUED || 0) + (counts.OFFER_ACCEPTED || 0) + (counts.OFFER_DECLINED || 0), color: '#c084fc' },
    { label: 'Interviews', key: 'INTERVIEWS', count: (counts.INTERVIEW_SCHEDULED || 0) + (counts.SELECTED || 0) + (counts.OFFER_ISSUED || 0) + (counts.OFFER_ACCEPTED || 0) + (counts.OFFER_DECLINED || 0), color: '#f59e0b' },
    { label: 'Selected / Offers', key: 'SELECTED', count: (counts.SELECTED || 0) + (counts.OFFER_ISSUED || 0) + (counts.OFFER_ACCEPTED || 0) + (counts.OFFER_DECLINED || 0), color: '#10b981' }
  ];

  const maxVal = Math.max(stages[0].count, 1);

  const barsHtml = stages.map(stage => {
    const widthPct = Math.max(Math.round((stage.count / maxVal) * 100), 6);
    return `
      <div style="margin-bottom: 0.85rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
          <span style="color: var(--text-secondary); font-weight: 500;">${stage.label}</span>
          <span style="color: var(--text-primary); font-weight: 700;">${stage.count}</span>
        </div>
        <div style="background: var(--bg-secondary); border-radius: var(--radius-full); height: 10px; overflow: hidden; border: 1px solid var(--border-color);">
          <div style="background: ${stage.color}; height: 100%; width: ${widthPct}%; border-radius: var(--radius-full); transition: width 0.6s ease;"></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Placement Pipeline Funnel</h3>
        <span class="badge badge-applied">Real-time</span>
      </div>
      <div style="padding-top: 0.5rem;">
        ${barsHtml}
      </div>
    </div>
  `;
};

/**
 * Renders an SVG Bar Chart for Department comparison
 */
window.components.renderBarChart = function({ title, data = [], xKey = 'branch', yKey = 'selected', yLabel = 'Placed' }) {
  if (!data || data.length === 0) return '';

  const maxVal = Math.max(...data.map(d => Number(d[yKey]) || 0), 1);

  const bars = data.map(item => {
    const val = Number(item[yKey]) || 0;
    const heightPct = Math.max(Math.round((val / maxVal) * 100), 8);
    const label = item[xKey] || 'N/A';
    return `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <span style="font-size: 0.75rem; font-weight: 700; color: var(--accent-cyan);">${val}</span>
        <div style="width: 100%; max-width: 45px; height: 120px; background: var(--bg-secondary); border-radius: var(--radius-sm); display: flex; align-items: flex-end; padding: 2px; border: 1px solid var(--border-color);">
          <div style="width: 100%; height: ${heightPct}%; background: linear-gradient(180deg, var(--accent-cyan), var(--accent-primary)); border-radius: 4px; transition: height 0.6s ease;"></div>
        </div>
        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${label}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">${title}</h3>
        <span style="font-size: 0.75rem; color: var(--text-muted);">${yLabel}</span>
      </div>
      <div style="display: flex; justify-content: space-around; align-items: flex-end; height: 160px; padding-top: 1rem;">
        ${bars}
      </div>
    </div>
  `;
};

/**
 * Renders an SVG Donut / Gauge for seat utilization
 */
window.components.renderDonutChart = function({ title, total = 10, used = 0 }) {
  const pct = Math.min(Math.round((used / Math.max(total, 1)) * 100), 100);
  const strokeDash = `${pct}, 100`;

  return `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">${title}</h3>
      </div>
      <div style="display: flex; align-items: center; justify-content: space-around; padding: 1rem 0;">
        <div style="position: relative; width: 110px; height: 110px;">
          <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
            <path stroke="var(--bg-secondary)" stroke-width="3.8" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path stroke="url(#donut-grad)" stroke-dasharray="${strokeDash}" stroke-width="3.8" stroke-linecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <defs>
              <linearGradient id="donut-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#38bdf8" />
                <stop offset="100%" stop-color="#10b981" />
              </linearGradient>
            </defs>
          </svg>
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <span style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); font-family: 'Outfit';">${pct}%</span>
            <span style="font-size: 0.65rem; color: var(--text-muted);">FILLED</span>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem;">
          <div><span style="color: var(--accent-cyan); font-weight: 700;">${used}</span> <span style="color: var(--text-muted);">Seats Filled</span></div>
          <div><span style="color: var(--text-primary); font-weight: 700;">${Math.max(total - used, 0)}</span> <span style="color: var(--text-muted);">Remaining</span></div>
          <div><span style="color: var(--text-secondary); font-weight: 700;">${total}</span> <span style="color: var(--text-muted);">Total Capacity</span></div>
        </div>
      </div>
    </div>
  `;
};
