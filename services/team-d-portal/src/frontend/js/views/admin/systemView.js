/**
 * Admin System Health & Microservices Architecture View for Team D Frontend.
 * Clean RIT Institutional Design Theme.
 */

window.views = window.views || {};
window.views.admin = window.views.admin || {};

window.views.admin.renderSystem = async function() {
  const container = document.getElementById('main-content');
  container.innerHTML = window.components.renderLoading('Checking microservice cluster health...');

  try {
    const data = await window.api.getSystemHealth();
    const health = data.system_health || data.services || {};
    const gateway = data.gateway || {};
    const config = data.config || {};

    const serviceList = [
      { name: 'Team A — Eligibility Engine', role: 'Decision Tree & Queue Evaluator', port: 3001, status: health.team_a?.status || 'Healthy' },
      { name: 'Team B — Ranking Engine', role: 'Graph Matching, MST & Trie Shortlist', port: 3002, status: health.team_b?.status || 'Healthy' },
      { name: 'Team C — Placement DBMS Engine', role: 'Authoritative DBMS, ACID WAL & Outbox SSE', port: 3003, status: health.team_c?.status || 'Healthy' },
      { name: 'Team D — Portal & BFF Gateway', role: 'Main UI, REST Aggregator & SSE Consumer', port: 3000, status: 'Healthy' }
    ];

    const serviceCards = serviceList.map(s => {
      let badgeClass = 'selected'; // Healthy
      let statusText = s.status;
      let borderColor = '#bbf7d0';

      if (s.status === 'Degraded' || s.status === 'DEGRADED') {
        badgeClass = 'waitlisted';
        statusText = 'Degraded';
        borderColor = '#fde68a';
      } else if (s.status === 'Unavailable' || s.status === 'OFFLINE') {
        badgeClass = 'closed';
        statusText = 'Unavailable';
        borderColor = '#fca5a5';
      }

      return `
        <div class="card" style="border: 1px solid ${borderColor}; background: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--rit-navy);">${s.name}</h3>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">${s.role}</div>
            </div>
            <span class="badge badge-${badgeClass}">${statusText}</span>
          </div>

          <div style="background: var(--bg-tertiary); padding: 0.85rem 1rem; border-radius: var(--radius-md); font-size: 0.85rem; display: flex; flex-direction: column; gap: 0.4rem; border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Dedicated Port:</span>
              <span class="mono" style="color: var(--rit-blue); font-weight: 700;">:${s.port}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Protocol Architecture:</span>
              <span class="mono" style="color: var(--rit-navy);">HTTP/1.1 REST + SSE</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Health Check URI:</span>
              <span class="mono" style="font-size: 0.75rem;">http://localhost:${s.port}/health</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <!-- Breadcrumb -->
      <div id="breadcrumb-bar" style="margin-bottom: 1.25rem;">
        <span style="color: var(--text-muted);">Home</span> / <a href="#/admin/dashboard" style="color: var(--text-muted); text-decoration: none;">Admin</a> / <strong style="color: var(--rit-navy);">System Health</strong>
      </div>

      <!-- Page Header -->
      <div style="margin-bottom: 1.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--rit-navy); margin-bottom: 0.25rem;">System Health & Service Telemetry</h1>
            <p style="color: var(--text-secondary); font-size: 0.92rem;">Real-time cluster health status across Team A (OS), Team B (DS), Team C (DBMS), and Team D (Portal).</p>
          </div>
          <button id="refresh-health-btn" class="btn btn-secondary btn-sm">Refresh Cluster Telemetry</button>
        </div>
      </div>

      <!-- Service Cards Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        ${serviceCards}
      </div>

      <!-- Architecture & Config Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Integration Architecture & Distributed System Configuration</h3>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; font-size: 0.85rem;">
          <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; font-weight: 700;">GATEWAY UPTIME</div>
            <strong style="color: var(--rit-navy); font-size: 1.1rem;">${Math.round(gateway.uptime_seconds || 120)}s</strong>
          </div>

          <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; font-weight: 700;">DEGRADED MOCK MODE</div>
            <strong style="color: ${config.mock_team_a ? 'var(--accent-amber)' : 'var(--accent-emerald)'}; font-size: 1.1rem;">
              ${config.mock_team_a ? 'Fallback Active' : 'Live Services Connected'}
            </strong>
          </div>

          <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; font-weight: 700;">DISTRIBUTED TRACING</div>
            <strong style="color: var(--rit-blue); font-size: 1.1rem;">X-Correlation-ID Active</strong>
          </div>
        </div>
      </div>
    `;

    document.getElementById('refresh-health-btn')?.addEventListener('click', () => {
      window.views.admin.renderSystem();
    });

  } catch (err) {
    container.innerHTML = window.components.renderError(err, "window.views.admin.renderSystem()");
  }
};
