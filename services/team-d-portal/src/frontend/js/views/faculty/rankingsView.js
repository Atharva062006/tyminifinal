/**
 * Faculty Candidate Rankings & Algorithm Simulation View for Team D.
 * Clean RIT Institutional Design Theme.
 */

window.views = window.views || {};
window.views.faculty = window.views.faculty || {};

window.views.faculty.renderRankings = async function() {
  const container = document.getElementById('main-content');
  container.innerHTML = window.components.renderLoading('Loading ranking analytics and candidate pool...');

  try {
    const drives = await window.api.getDrives();
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const activeDriveId = urlParams.get('drive_id') || drives[0]?.drive_id || '';

    const driveOptionsHtml = drives.map(d => `
      <option value="${d.drive_id}" ${d.drive_id === activeDriveId ? 'selected' : ''}>
        ${d.company?.name || 'Company'} — ${d.title}
      </option>
    `).join('');

    container.innerHTML = `
      <!-- Breadcrumb -->
      <div id="breadcrumb-bar" style="margin-bottom: 1.25rem;">
        <span style="color: var(--text-muted);">Home</span> / <strong style="color: var(--rit-navy);">Faculty Rankings Management</strong>
      </div>

      <!-- Page Header -->
      <div style="margin-bottom: 1.75rem;">
        <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--rit-navy); margin-bottom: 0.25rem;">Candidate Rankings & Shortlist Analytics</h1>
        <p style="color: var(--text-secondary); font-size: 0.92rem;">Execute and compare ranking algorithms against candidate pools using Team B's Graph Engine.</p>
      </div>

      <!-- Top Controls Card -->
      <div class="card" style="margin-bottom: 1.5rem; background: #ffffff;">
        <div class="card-header">
          <h3 class="card-title">Ranking Algorithm & Weight Parameters</h3>
          <span class="badge badge-applied">Team B Authoritative Engine</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; align-items: flex-end;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="color: var(--rit-navy); font-weight: 700;">Placement Drive</label>
            <select id="rank-drive-select" class="form-control">
              ${driveOptionsHtml}
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="color: var(--rit-navy); font-weight: 700;">Ranking Algorithm</label>
            <select id="rank-algo-select" class="form-control">
              <option value="WEIGHTED_SCORE" selected>Weighted Score (Graph Edges)</option>
              <option value="HEAP_TOPK">Heap Top-K (Min-Heap)</option>
              <option value="MERGE_SORT">Merge Sort (Deterministic)</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="color: var(--rit-navy); font-weight: 700;">CGPA Weight (0-1)</label>
            <input type="number" id="weight-cgpa" class="form-control" value="0.4" step="0.1" min="0" max="1" />
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="color: var(--rit-navy); font-weight: 700;">Skills Weight (0-1)</label>
            <input type="number" id="weight-skills" class="form-control" value="0.4" step="0.1" min="0" max="1" />
          </div>

          <div>
            <button id="compute-ranking-btn" class="btn btn-primary" style="width: 100%; background: var(--rit-blue);">
              Compute Rankings
            </button>
          </div>
        </div>
      </div>

      <!-- Ranking Output Container -->
      <div id="rankings-output-container"></div>
    `;

    const driveSelect = document.getElementById('rank-drive-select');
    const algoSelect = document.getElementById('rank-algo-select');
    const computeBtn = document.getElementById('compute-ranking-btn');
    const outputContainer = document.getElementById('rankings-output-container');

    const executeRanking = async () => {
      const driveId = driveSelect.value;
      const algorithm = algoSelect.value;
      const wCgpa = parseFloat(document.getElementById('weight-cgpa').value) || 0.4;
      const wSkills = parseFloat(document.getElementById('weight-skills').value) || 0.4;
      const wAttendance = parseFloat((1 - (wCgpa + wSkills)).toFixed(2)) || 0.2;

      outputContainer.innerHTML = window.components.renderLoading('Computing ranking order via Team B DS Engine...');

      try {
        const result = await window.api.previewRanking(driveId, algorithm, {
          cgpa: wCgpa,
          skills: wSkills,
          attendance: Math.max(wAttendance, 0)
        });

        const rankings = result.rankings || [];

        const tableHtml = window.components.renderDataTable({
          columns: [
            {
              label: 'Rank',
              render: row => {
                let rankText = `#${row.rank}`;
                return `<strong style="color: var(--rit-blue); font-size: 1.05rem;">${rankText}</strong>`;
              }
            },
            {
              label: 'Candidate Name',
              render: row => `<strong style="color: var(--rit-navy);">${row.name}</strong><br><span class="mono" style="font-size: 0.75rem; color: var(--text-muted);">${row.student_id}</span>`
            },
            { label: 'Branch', render: row => row.branch || 'CSE' },
            { label: 'CGPA', render: row => `<span style="font-weight: 700; color: var(--rit-navy);">${row.cgpa}</span>` },
            {
              label: 'Match Score',
              render: row => {
                const pct = (row.total_score * 100).toFixed(1);
                return `
                  <div style="display: flex; align-items: center; gap: 0.75rem; min-width: 140px;">
                    <strong style="color: var(--accent-emerald); font-family: 'JetBrains Mono'; width: 45px;">${pct}%</strong>
                    <div style="flex: 1; height: 7px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                      <div style="width: ${pct}%; height: 100%; background: var(--rit-blue); border-radius: 4px;"></div>
                    </div>
                  </div>
                `;
              }
            },
            { label: 'Workflow State', render: row => window.components.renderBadge(row.application_state || 'APPLIED') }
          ],
          rows: rankings,
          emptyMessage: 'No candidates available for ranking.'
        });

        outputContainer.innerHTML = `
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Computed Shortlist: ${result.drive_title}</h3>
                <span style="font-size: 0.75rem; color: var(--text-muted);">
                  Algorithm: <strong>${result.algorithm}</strong> • Latency: <strong>${result.computation_time_ms || 14} ms</strong> • Candidates: <strong>${result.candidates_count}</strong>
                </span>
              </div>
              ${result.degraded ? '<span class="badge badge-closed">Degraded Fallback</span>' : '<span class="badge badge-open">Optimized</span>'}
            </div>
            ${tableHtml}
          </div>
        `;
      } catch (err) {
        outputContainer.innerHTML = window.components.renderError(err, null);
      }
    };

    computeBtn.addEventListener('click', executeRanking);

    if (activeDriveId) {
      executeRanking();
    }

  } catch (err) {
    container.innerHTML = window.components.renderError(err, "window.views.faculty.renderRankings()");
  }
};
