/**
 * Structured Placement Drive Detail View for Student Portal.
 * Clean RIT Institutional Design Theme.
 */

window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderDriveDetail = async function(driveId) {
  const container = document.getElementById('main-content');
  
  // Loading Skeleton
  container.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Loading placement drive details and application status...</p>
    </div>
  `;

  try {
    const user = window.store.get('user') || {};
    const [drive, studentApps] = await Promise.all([
      window.api.getDrive(driveId),
      window.api.getApplications({ student_id: user.id }).catch(() => [])
    ]);

    const company = drive.company || {};
    const criteria = drive.criteria || {};

    const pkg = drive.package ? `₹${(drive.package / 100000).toFixed(1)} LPA` : '—';
    const branches = criteria.branches || criteria.allowed_branches || ['All Engineering Branches'];
    const skills = criteria.required_skills || ['Programming Proficiency', 'Problem Solving'];

    // State Evaluation
    const myApp = studentApps.find(a => a.drive_id === driveId);
    const isApplied = !!myApp;
    const isClosed = drive.state === 'CLOSED';
    const isDeadlinePassed = drive.deadline ? (new Date() > new Date(drive.deadline)) : false;

    // Real-time Student Eligibility Check
    const minCgpa = criteria.min_cgpa !== undefined ? criteria.min_cgpa : 7.0;
    const maxBacklogs = criteria.max_backlogs !== undefined ? criteria.max_backlogs : 1;
    const studentCgpa = user.cgpa !== undefined ? user.cgpa : 8.0;
    const studentBacklogs = user.backlogs !== undefined ? user.backlogs : 0;
    const studentBranch = user.branch || 'CSE';

    const isEligible = (studentCgpa >= minCgpa) && 
                       (studentBacklogs <= maxBacklogs) && 
                       (branches.includes('All Engineering Branches') || branches.includes('All Branches') || branches.includes(studentBranch));

    // Apply Button Prominence & Reason Handling
    let applyButtonHtml = '';
    if (isApplied) {
      applyButtonHtml = `
        <button class="btn btn-secondary btn-lg" disabled style="opacity: 0.8; cursor: not-allowed;">
          Already Applied (${myApp.state || 'APPLIED'})
        </button>
      `;
    } else if (isClosed) {
      applyButtonHtml = `
        <button class="btn btn-secondary btn-lg" disabled style="opacity: 0.6; cursor: not-allowed;">
          Drive Closed
        </button>
      `;
    } else if (isDeadlinePassed) {
      applyButtonHtml = `
        <button class="btn btn-secondary btn-lg" disabled style="opacity: 0.6; cursor: not-allowed;">
          Deadline Passed
        </button>
      `;
    } else if (!isEligible) {
      applyButtonHtml = `
        <button class="btn btn-danger btn-lg" disabled title="Student CGPA/Branch fails eligibility criteria" style="opacity: 0.7; cursor: not-allowed;">
          Not Eligible to Apply
        </button>
      `;
    } else {
      applyButtonHtml = `
        <button id="apply-now-btn" class="btn btn-primary btn-lg" style="background: var(--rit-blue); font-size: 1rem; padding: 0.75rem 1.75rem;">
          Apply for Drive Now
        </button>
      `;
    }

    container.innerHTML = `
      <!-- Breadcrumb -->
      <div id="breadcrumb-bar" style="margin-bottom: 1.25rem;">
        <span style="color: var(--text-muted);">Home</span> / <a href="#/student/drives" style="color: var(--text-muted); text-decoration: none;">Placements</a> / <strong style="color: var(--rit-navy);">${drive.title}</strong>
      </div>

      <!-- Page Header & Action Bar -->
      <div style="margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1.25rem;">
          <div>
            <div style="font-size: 0.85rem; color: var(--rit-blue); font-weight: 700; text-transform: uppercase; margin-bottom: 0.2rem;">${company.name || 'Company'}</div>
            <h1 style="font-size: 2rem; font-weight: 800; color: var(--rit-navy);">${drive.title}</h1>
            <p style="color: var(--text-secondary); font-size: 0.92rem; margin-top: 0.25rem;">
              Offered CTC Package: <strong style="color: var(--accent-emerald);">${pkg}</strong> • Placement Drive ID: <span class="mono">${drive.drive_id}</span>
            </p>
          </div>
          
          <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            <span class="badge ${isClosed ? 'badge-closed' : 'badge-open'}" style="font-size: 0.85rem; padding: 0.4rem 0.85rem;">${drive.state || 'OPEN'}</span>
            ${applyButtonHtml}
          </div>
        </div>
      </div>

      <!-- Detail Grid Sections -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
        
        <!-- Left Column: Company, Job, Criteria, Selection Process -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- 1. Company Information -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Company Information</h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.85rem; font-size: 0.9rem;">
              <div>
                <strong style="color: var(--rit-navy); display: block; margin-bottom: 0.2rem;">Company Overview:</strong>
                <p style="color: var(--text-secondary); line-height: 1.5;">${company.description || `${company.name || 'Company'} is a leading institutional placement partner offering technical software engineering roles for campus graduates.`}</p>
              </div>
              <div style="display: flex; gap: 2rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem; flex-wrap: wrap;">
                <div>
                  <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">INDUSTRY DOMAIN</span>
                  <strong style="color: var(--rit-navy);">${company.industry || 'Information Technology'}</strong>
                </div>
                <div>
                  <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">HEADQUARTERS</span>
                  <strong style="color: var(--rit-navy);">${company.headquarters || 'Pune / Bengaluru'}</strong>
                </div>
                <div>
                  <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">OFFICIAL WEBSITE</span>
                  <a href="${company.website || '#'}" target="_blank" rel="noopener" style="color: var(--rit-blue); font-weight: 600;">${company.website || 'Visit Official Site'}</a>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Job Details -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Job Details & Scope</h3>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; font-size: 0.88rem;">
              <div style="background: var(--bg-tertiary); padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">JOB ROLE</span>
                <div style="font-size: 1rem; font-weight: 700; color: var(--rit-navy); margin-top: 0.15rem;">${drive.title}</div>
              </div>
              <div style="background: var(--bg-tertiary); padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">COMPENSATION PACKAGE</span>
                <div style="font-size: 1rem; font-weight: 700; color: var(--accent-emerald); margin-top: 0.15rem;">${pkg}</div>
              </div>
              <div style="background: var(--bg-tertiary); padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">LOCATION / VENUE</span>
                <div style="font-size: 1rem; font-weight: 700; color: var(--rit-navy); margin-top: 0.15rem;">${drive.location || drive.venue || 'RIT Campus On-Site'}</div>
              </div>
              <div style="background: var(--bg-tertiary); padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">TOTAL OPEN SEATS</span>
                <div style="font-size: 1rem; font-weight: 700; color: var(--rit-blue); margin-top: 0.15rem;">${drive.seats || '—'} Positions</div>
              </div>
            </div>
          </div>

          <!-- 3. Eligibility Criteria -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Eligibility Criteria</h3>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Evaluated via Team A OS Decision Engine</span>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
              <div style="background: #ffffff; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">MINIMUM CGPA</span>
                <div style="font-size: 1.35rem; font-weight: 800; color: var(--rit-navy); margin-top: 0.2rem;">≥ ${minCgpa}</div>
                <span style="font-size: 0.7rem; color: var(--text-muted);">Out of 10.0 scale</span>
              </div>

              <div style="background: #ffffff; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">MAX ACTIVE BACKLOGS</span>
                <div style="font-size: 1.35rem; font-weight: 800; color: var(--accent-amber); margin-top: 0.2rem;">≤ ${maxBacklogs}</div>
                <span style="font-size: 0.7rem; color: var(--text-muted);">Live backlogs permitted</span>
              </div>

              <div style="background: #ffffff; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">YOUR EVALUATION</span>
                <div style="font-size: 1.1rem; font-weight: 800; color: ${isEligible ? 'var(--accent-emerald)' : 'var(--accent-rose)'}; margin-top: 0.35rem;">
                  ${isEligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                </div>
              </div>
            </div>

            <div style="margin-bottom: 1rem;">
              <strong style="font-size: 0.85rem; color: var(--rit-navy); display: block; margin-bottom: 0.4rem;">Eligible Branches:</strong>
              <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                ${branches.map(b => `<span class="badge" style="background: #eff6ff; color: var(--rit-blue); border: 1px solid #bfdbfe;">${b}</span>`).join('')}
              </div>
            </div>

            <div>
              <strong style="font-size: 0.85rem; color: var(--rit-navy); display: block; margin-bottom: 0.4rem;">Required Technical Skills:</strong>
              <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                ${skills.map(s => `<span class="badge" style="background: #f1f5f9; color: var(--text-primary); border: 1px solid var(--border-color);">${s}</span>`).join('')}
              </div>
            </div>
          </div>

          <!-- 4. Selection Process -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Selection Process Workflow</h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--rit-blue); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem;">1</div>
                <div>
                  <strong style="color: var(--rit-navy); font-size: 0.92rem;">Online Application & Eligibility Rule Evaluation</strong>
                  <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.15rem;">Automated OS decision tree rule check verifying CGPA, branch, and backlog constraints.</p>
                </div>
              </div>
              <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--rit-blue); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem;">2</div>
                <div>
                  <strong style="color: var(--rit-navy); font-size: 0.92rem;">Candidate Graph Match Ranking</strong>
                  <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.15rem;">Team B graph matching engine ranks eligible applicants based on weighted skill scores.</p>
                </div>
              </div>
              <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--rit-blue); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem;">3</div>
                <div>
                  <strong style="color: var(--rit-navy); font-size: 0.92rem;">Technical & HR Interview Rounds</strong>
                  <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.15rem;">Shortlisted candidates are scheduled for virtual interview panels.</p>
                </div>
              </div>
              <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--accent-emerald); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem;">4</div>
                <div>
                  <strong style="color: var(--rit-navy); font-size: 0.92rem;">Formal Offer Issuance & DBMS Commit</strong>
                  <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.15rem;">Authoritative seat claim committed to Team C ACID log database.</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Right Column: Important Dates & Application Status -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- 5. Important Dates -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Important Dates</h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.85rem; font-size: 0.85rem;">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">Registration Deadline:</span>
                <strong style="color: var(--rit-navy);">${drive.deadline ? new Date(drive.deadline).toLocaleDateString() : 'Active Session'}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">Placement Drive Date:</span>
                <strong style="color: var(--rit-navy);">${drive.drive_date || 'To Be Announced'}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">Interview Schedule:</span>
                <strong style="color: var(--rit-blue);">Post-Shortlist</strong>
              </div>
            </div>
          </div>

          <!-- 6. Application Status -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Application Status</h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.85rem; font-size: 0.85rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text-muted);">Current Status:</span>
                ${isApplied ? `<span class="badge badge-applied">${myApp.state || 'APPLIED'}</span>` : `<span class="badge badge-open">NOT APPLIED</span>`}
              </div>
              ${isApplied ? `
                <div style="background: var(--bg-tertiary); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                  <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">APPLICATION ID</span>
                  <strong style="font-family: 'JetBrains Mono'; font-size: 0.85rem; color: var(--rit-navy);">${myApp.application_id}</strong>
                </div>
                <a href="#/student/applications/${myApp.application_id}" class="btn btn-secondary btn-sm" style="text-align: center;">View Full Application Timeline →</a>
              ` : ''}
            </div>
          </div>

        </div>

      </div>
    `;

    // Bind Apply Now button modal trigger
    const applyBtn = document.getElementById('apply-now-btn');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        window.views.student._openApplicationModal(drive, user);
      });
    }

  } catch (err) {
    container.innerHTML = window.components.renderError(err, `window.views.student.renderDriveDetail('${driveId}')`);
  }
};
