/**
 * Role-aware Student Candidate Rankings & Privacy Protection View for RIT Portal.
 * Clean RIT Institutional Design Theme with Team B DS Engine.
 */

window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderRankings = async function() {
  const container = document.getElementById('main-content');
  container.innerHTML = window.components.renderLoading('Fetching candidate rankings from Team B DS Engine...');

  try {
    const user = window.store.get('user') || {};
    const drives = await window.api.getDrives();
    
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const activeDriveId = urlParams.get('drive_id') || drives[0]?.drive_id || 'DRV001';

    const driveOptionsHtml = drives.map(d => `
      <option value="${d.drive_id}" ${d.drive_id === activeDriveId ? 'selected' : ''}>
        ${d.company?.name || 'Company'} — ${d.title}
      </option>
    `).join('');

    container.innerHTML = `
      <!-- Breadcrumb -->
      <div id="breadcrumb-bar" style="margin-bottom: 1.25rem;">
        <span style="color: var(--text-muted);">Home</span> / <strong style="color: var(--rit-navy);">Rankings</strong>
      </div>

      <!-- Page Header -->
      <div style="margin-bottom: 1.75rem;">
        <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--rit-navy); margin-bottom: 0.25rem;">Placement Rankings</h1>
        <p style="color: var(--text-secondary); font-size: 0.92rem;">Authoritative candidate match scores computed via Team B Graph Engine.</p>
      </div>

      <!-- Context Bar: Drive Selector -->
      <div class="card" style="margin-bottom: 1.5rem; background: #ffffff;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="color: var(--rit-navy); font-weight: 700;">Selected Placement Drive:</label>
          <select id="ranking-drive-select" class="form-control" style="font-size: 0.95rem; font-weight: 600;">
            ${driveOptionsHtml}
          </select>
        </div>
      </div>

      <!-- Output Panel Container -->
      <div id="ranking-results-panel">
        <div class="loading-container">
          <div class="spinner"></div>
          <p>Computing candidate leaderboard...</p>
        </div>
      </div>
    `;

    const driveSelect = document.getElementById('ranking-drive-select');
    const resultsPanel = document.getElementById('ranking-results-panel');

    const loadRankings = async () => {
      const driveId = driveSelect.value;
      if (!driveId) return;

      resultsPanel.innerHTML = window.components.renderLoading('Fetching rankings from Team B Engine...');

      try {
        const rankingData = await window.api.getRankings(driveId);
        const rankings = rankingData.rankings || [];
        const myRanking = rankingData.my_ranking || rankings.find(r => r.student_id === user.id);
        const totalCandidates = rankingData.candidates_count || rankings.length;
        const targetDrive = drives.find(d => d.drive_id === driveId) || {};
        const companyName = targetDrive.company?.name || rankingData.company_name || 'Company';

        const myScorePct = myRanking ? (myRanking.total_score * 100).toFixed(1) : '—';

        resultsPanel.innerHTML = `
          <!-- Logged-In Student Personal Standing Card -->
          <div class="card" style="background: #eff6ff; border: 1px solid #bfdbfe; margin-bottom: 1.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
              <div>
                <div style="font-size: 0.75rem; color: var(--rit-blue); font-weight: 700; text-transform: uppercase;">YOUR PERSONAL RANKING POSITION</div>
                <h2 style="font-size: 1.85rem; font-weight: 800; color: var(--rit-navy); margin-top: 0.2rem;">
                  ${myRanking ? `Rank #${myRanking.rank} <span style="font-size: 1.1rem; color: var(--text-secondary);">/ ${totalCandidates} Candidates</span>` : 'Ranking Pending'}
                </h2>
                <p style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 0.2rem;">
                  Match Score: <strong style="color: var(--accent-emerald); font-family: 'JetBrains Mono';">${myScorePct}%</strong> • Drive: <strong>${rankingData.drive_title || targetDrive.title}</strong> (${companyName})
                </p>
                ${myRanking?.score_breakdown ? `
                  <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.4rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                    <span>CGPA Factor: <strong>${myRanking.score_breakdown.cgpa_component}</strong></span>
                    <span>Skills Factor: <strong>${myRanking.score_breakdown.skills_component}</strong></span>
                    <span>Attendance Factor: <strong>${myRanking.score_breakdown.attendance_component}</strong></span>
                  </div>
                ` : ''}
              </div>
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                <span class="badge badge-selected" style="font-size: 0.85rem; padding: 0.45rem 0.9rem;">Team B Computed</span>
                ${myRanking ? window.components.renderBadge(myRanking.application_state || 'SHORTLISTED') : ''}
              </div>
            </div>
          </div>

          <!-- Leaderboard Table (Privacy Preserved) -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Placement Drive Leaderboard: ${rankingData.drive_title || targetDrive.title}</h3>
                <span style="font-size: 0.75rem; color: var(--text-muted);">
                  Algorithm: <strong>${rankingData.algorithm || 'WEIGHTED_SCORE'}</strong> • Updated: ${new Date(rankingData.timestamp || Date.now()).toLocaleTimeString()}
                </span>
              </div>
              ${rankingData.degraded ? '<span class="badge badge-closed">Degraded Fallback</span>' : '<span class="badge badge-open">Optimized</span>'}
            </div>

            ${window.components.renderDataTable({
              columns: [
                {
                  label: 'Rank',
                  render: row => {
                    let rankText = `#${row.rank}`;
                    return row.student_id === user.id
                      ? `<strong style="color: var(--rit-blue); font-size: 1.1rem;">${rankText}</strong>`
                      : `<span style="font-weight: 600; color: var(--rit-navy);">${rankText}</span>`;
                  }
                },
                {
                  label: 'Candidate',
                  render: row => row.student_id === user.id
                    ? `<strong style="color: var(--rit-blue);">${row.name || user.name || row.student_id} (You)</strong>`
                    : `<span style="color: var(--text-muted);">${row.name || `Candidate #${row.rank}`}</span>`
                },
                {
                  label: 'Score',
                  render: row => {
                    const pct = (row.total_score * 100).toFixed(1);
                    return `
                      <div style="display: flex; align-items: center; gap: 0.75rem; min-width: 140px;">
                        <strong style="color: ${row.student_id === user.id ? 'var(--accent-emerald)' : 'var(--rit-navy)'}; font-family: 'JetBrains Mono'; width: 45px;">${pct}%</strong>
                        <div style="flex: 1; height: 7px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                          <div style="width: ${pct}%; height: 100%; background: ${row.student_id === user.id ? 'var(--accent-emerald)' : 'var(--rit-blue)'}; border-radius: 4px;"></div>
                        </div>
                      </div>
                    `;
                  }
                },
                {
                  label: 'Status',
                  render: row => window.components.renderBadge(row.application_state || 'SHORTLISTED')
                }
              ],
              rows: rankings,
              emptyMessage: 'No candidate rankings calculated for this drive yet.'
            })}
          </div>
        `;
      } catch (err) {
        resultsPanel.innerHTML = window.components.renderError(err, null);
      }
    };

    driveSelect.addEventListener('change', loadRankings);
    loadRankings();

  } catch (err) {
    container.innerHTML = window.components.renderError(err, "window.views.student.renderRankings()");
  }
};
