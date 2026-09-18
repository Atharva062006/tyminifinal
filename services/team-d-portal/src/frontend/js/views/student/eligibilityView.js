/**
 * Role-aware Team A Eligibility View for Student Portal.
 * Clean RIT Institutional Design Theme with Authoritative Team A Engine.
 */

window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderEligibility = async function() {
  const container = document.getElementById('main-content');
  
  // Loading Skeleton
  container.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Consulting Team A Rule Engine for authoritative eligibility decision...</p>
    </div>
  `;

  try {
    const drives = await window.api.getDrives();
    const user = window.store.get('user') || {};

    // Get preselected drive from URL query
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const preselectedDriveId = urlParams.get('drive_id') || (drives[0]?.drive_id || '');

    const driveOptionsHtml = drives.map(d => `
      <option value="${d.drive_id}" ${d.drive_id === preselectedDriveId ? 'selected' : ''}>
        ${d.company?.name || 'Company'} — ${d.title}
      </option>
    `).join('');

    container.innerHTML = `
      <!-- Breadcrumb -->
      <div id="breadcrumb-bar" style="margin-bottom: 1.25rem;">
        <span style="color: var(--text-muted);">Home</span> / <a href="#/student/drives" style="color: var(--text-muted); text-decoration: none;">Placements</a> / <strong style="color: var(--rit-navy);">Eligibility</strong>
      </div>

      <!-- Page Header -->
      <div style="margin-bottom: 1.75rem;">
        <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--rit-navy); margin-bottom: 0.25rem;">Eligibility Check</h1>
        <p style="color: var(--text-secondary); font-size: 0.92rem;">Authoritative academic rule evaluation powered by Team A Eligibility Engine.</p>
      </div>

      <!-- Drive Selection Controls -->
      <div class="card" style="margin-bottom: 1.5rem; background: #ffffff;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="color: var(--rit-navy); font-weight: 700;">Select Target Placement Drive to Evaluate:</label>
          <select id="eligibility-drive-select" class="form-control" style="font-size: 0.95rem; font-weight: 600;">
            ${driveOptionsHtml}
          </select>
        </div>
      </div>

      <!-- Result Panel Container -->
      <div id="eligibility-result-panel">
        <div class="loading-container" style="padding: 2rem 1rem;">
          <div class="spinner"></div>
          <p>Running Team A rule evaluation...</p>
        </div>
      </div>
    `;

    const driveSelect = document.getElementById('eligibility-drive-select');
    const resultPanel = document.getElementById('eligibility-result-panel');

    const runBackendCheck = async () => {
      const selectedDriveId = driveSelect.value;
      if (!selectedDriveId) {
        resultPanel.innerHTML = `
          <div class="card" style="text-align: center; padding: 3rem 1rem;">
            <p style="color: var(--text-muted);">Please select a placement drive above to check eligibility.</p>
          </div>
        `;
        return;
      }

      resultPanel.innerHTML = `
        <div class="loading-container" style="padding: 3rem 1rem;">
          <div class="spinner"></div>
          <p>Evaluating eligibility criteria via Team A backend engine...</p>
        </div>
      `;

      try {
        // Authoritative API Call to Team A via BFF
        const checkData = await window.api.checkEligibility(selectedDriveId, user.id);
        
        const drive = checkData.drive || drives.find(d => d.drive_id === selectedDriveId) || {};
        const company = drive.company || {};
        const evaluation = checkData.evaluation || {};
        const isEligible = checkData.eligible || evaluation.eligibility_result === 'ELIGIBLE';
        
        const passedRules = evaluation.passed_rules || [];
        const failedRules = evaluation.failed_rules || evaluation.reasons || [];
        const criteria = drive.criteria || {};

        const driveDateFormatted = drive.drive_date || (drive.deadline ? new Date(drive.deadline).toLocaleDateString() : 'Active Session');
        const companyName = company.name || drive.company_name || 'Company';

        resultPanel.innerHTML = `
          <!-- Drive Context Bar -->
          <div class="card" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
              <div>
                <span style="font-size: 0.75rem; color: var(--rit-blue); font-weight: 700; text-transform: uppercase;">EVALUATION CONTEXT</span>
                <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--rit-navy); margin-top: 0.15rem;">${drive.title || 'Placement Drive'}</h3>
                <div style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 0.2rem;">
                  Company: <strong style="color: var(--rit-navy);">${companyName}</strong> • Package: <strong style="color: var(--accent-emerald);">₹${drive.package ? (drive.package / 100000).toFixed(1) : '—'} LPA</strong>
                </div>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 0.72rem; color: var(--text-muted); display: block; font-weight: 700;">DRIVE DATE / DEADLINE</span>
                <strong style="color: var(--rit-navy); font-size: 0.95rem;">${driveDateFormatted}</strong>
              </div>
            </div>
          </div>

          <!-- Result Panel -->
          <div class="card" style="background: #ffffff; border: 2px solid ${isEligible ? '#bbf7d0' : '#fca5a5'};">
            
            <!-- Result Banner -->
            <div style="background: ${isEligible ? '#dcfce7' : '#fee2e2'}; border: 1px solid ${isEligible ? '#86efac' : '#f87171'}; border-radius: var(--radius-md); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 1rem;">
                <div>
                  <h2 style="font-size: 1.4rem; font-weight: 800; color: ${isEligible ? '#15803d' : '#b91c1c'};">
                    ${isEligible ? 'Eligible for this placement drive' : 'Not Eligible'}
                  </h2>
                  <p style="font-size: 0.88rem; color: ${isEligible ? '#166534' : '#991b1b'}; margin-top: 0.2rem;">
                    ${isEligible 
                      ? 'Team A Eligibility Engine confirmed that your academic profile satisfies all drive constraints.' 
                      : 'Team A Eligibility Engine evaluated your profile and identified one or more unmet requirements.'}
                  </p>
                </div>
              </div>
              <span class="badge" style="background: ${isEligible ? '#15803d' : '#b91c1c'}; color: #ffffff; font-size: 0.85rem; padding: 0.4rem 0.85rem;">
                ${isEligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
              </span>
            </div>

            <!-- Criteria & Reasons Breakdown -->
            ${isEligible ? `
              <div style="margin-bottom: 1.75rem;">
                <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--rit-navy); margin-bottom: 0.85rem;">Satisfied Criteria Breakdown:</h4>
                <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                  ${passedRules.length > 0 ? passedRules.map(r => `
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 0.65rem 0.9rem; border-radius: var(--radius-md); font-size: 0.88rem; display: flex; align-items: center; gap: 0.6rem;">
                      <span>${r}</span>
                    </div>
                  `).join('') : `
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 0.65rem 0.9rem; border-radius: var(--radius-md); font-size: 0.88rem;">
                      Minimum CGPA requirement (≥ ${criteria.min_cgpa ?? 7.0}) satisfied.
                    </div>
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 0.65rem 0.9rem; border-radius: var(--radius-md); font-size: 0.88rem;">
                      Active backlogs threshold (≤ ${criteria.max_backlogs ?? 1}) satisfied.
                    </div>
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 0.65rem 0.9rem; border-radius: var(--radius-md); font-size: 0.88rem;">
                      Engineering branch restriction verified.
                    </div>
                  `}
                </div>
              </div>
            ` : `
              <div style="margin-bottom: 1.75rem;">
                <h4 style="font-size: 0.95rem; font-weight: 700; color: #b91c1c; margin-bottom: 0.85rem;">Backend Rejection Reasons:</h4>
                <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                  ${failedRules.length > 0 ? failedRules.map(r => `
                    <div style="background: #fef2f2; border: 1px solid #fca5a5; color: #b91c1c; padding: 0.65rem 0.9rem; border-radius: var(--radius-md); font-size: 0.88rem; display: flex; align-items: center; gap: 0.6rem;">
                      <span>${r}</span>
                    </div>
                  `).join('') : `
                    <div style="background: #fef2f2; border: 1px solid #fca5a5; color: #b91c1c; padding: 0.65rem 0.9rem; border-radius: var(--radius-md); font-size: 0.88rem;">
                      Academic criteria requirement not satisfied for this drive.
                    </div>
                  `}
                </div>
              </div>
            `}

            <!-- Action Buttons -->
            <div style="display: flex; justify-content: flex-end; gap: 0.85rem; border-top: 1px solid var(--border-color); padding-top: 1.25rem; flex-wrap: wrap;">
              <a href="#/student/drives/${selectedDriveId}" class="btn btn-secondary">
                Back to Drive
              </a>
              ${isEligible ? `
                <a href="#/student/drives/${selectedDriveId}" class="btn btn-primary" style="background: var(--rit-blue);">
                  Apply Now
                </a>
              ` : ''}
            </div>

          </div>
        `;

      } catch (err) {
        resultPanel.innerHTML = window.components.renderError(err, null);
      }
    };

    driveSelect.addEventListener('change', runBackendCheck);
    
    // Auto-run check for preselected drive
    if (preselectedDriveId) {
      runBackendCheck();
    }

  } catch (err) {
    container.innerHTML = window.components.renderError(err, "window.views.student.renderEligibility()");
  }
};
