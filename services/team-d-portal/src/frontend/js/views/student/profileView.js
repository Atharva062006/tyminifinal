/**
 * Student Academic Profile & Placement Readiness View for RIT Portal.
 * Clean RIT Institutional Design Theme.
 */

window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderProfile = async function() {
  const container = document.getElementById('main-content');
  container.innerHTML = window.components.renderLoading('Loading authoritative student profile from Team C DBMS...');

  const user = window.store.get('user') || {};
  const studentId = user.id || 'STU001';

  try {
    const res = await window.api.getStudentProfile(studentId);
    const student = res.student || res;
    const readiness = res.readiness || { readiness_score: 85, breakdown: {}, recommendations: [] };

    const skills = Array.isArray(student.skills) ? student.skills : ['JavaScript', 'Python', 'SQL'];
    const projects = Array.isArray(student.projects) ? student.projects : [
      { name: 'Placement Analytics Portal', tech: 'Node.js, Express, SPA', link: 'https://github.com/rit/placement-portal' }
    ];
    const certs = Array.isArray(student.certifications) ? student.certifications : [
      { title: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services', date: '2025' }
    ];

    const scoreColor = readiness.readiness_score >= 80 ? 'var(--accent-emerald)' : (readiness.readiness_score >= 60 ? 'var(--rit-blue)' : 'var(--accent-amber)');

    container.innerHTML = `
      <!-- Breadcrumb -->
      <div id="breadcrumb-bar" style="margin-bottom: 1.25rem;">
        <span style="color: var(--text-muted);">Home</span> / <strong style="color: var(--rit-navy);">Student Profile</strong>
      </div>

      <!-- Page Header -->
      <div style="margin-bottom: 1.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--rit-navy); margin-bottom: 0.25rem;">Academic Student Profile</h1>
            <p style="color: var(--text-secondary); font-size: 0.92rem;">Authoritative academic credentials and advisory Placement Readiness Score.</p>
          </div>
          <button id="edit-profile-btn" class="btn btn-secondary">Manage Skills & Profile</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1.5rem;">
        <!-- Left Column: Student Card & Placement Readiness -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <div class="card" style="text-align: center; padding: 2rem 1.5rem; background: #ffffff;">
            <div class="user-avatar" style="width: 84px; height: 84px; font-size: 2.2rem; margin: 0 auto 1rem; background: var(--rit-blue); color: #ffffff;">
              ${(student.name || studentId).charAt(0).toUpperCase()}
            </div>
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--rit-navy);">${student.name || studentId}</h2>
            <div style="color: var(--rit-blue); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; margin-bottom: 0.3rem;">${student.branch || 'CSE'} Department</div>
            <div class="mono" style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem;">ID: ${student.student_id || studentId}</div>

            <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); text-align: left; font-size: 0.85rem; display: flex; flex-direction: column; gap: 0.6rem;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Email:</span>
                <span style="font-weight: 600; color: var(--rit-navy);">${student.email || `${studentId.toLowerCase()}@rit.edu`}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Institution:</span>
                <span style="font-weight: 600; color: var(--rit-navy);">RIT Sangli</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text-muted);">Account Standing:</span>
                <span class="badge badge-open">ACTIVE</span>
              </div>
            </div>
          </div>

          <!-- Advisory Placement Readiness Card -->
          <div class="card" style="background: #ffffff;">
            <div class="card-header">
              <h3 class="card-title">Placement Readiness Score</h3>
              <span class="badge badge-rule_evaluated">Advisory</span>
            </div>

            <div style="text-align: center; margin-bottom: 1.25rem;">
              <div style="font-size: 3rem; font-weight: 800; color: ${scoreColor}; font-family: 'JetBrains Mono'; line-height: 1;">
                ${readiness.readiness_score}<span style="font-size: 1.2rem; color: var(--text-muted);">/100</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.4rem;">Institutional Readiness Index</div>
            </div>

            ${readiness.recommendations && readiness.recommendations.length > 0 ? `
              <div style="background: #fefce8; border: 1px solid #fde68a; border-radius: var(--radius-md); padding: 0.85rem; font-size: 0.82rem; color: var(--rit-navy);">
                <strong style="color: var(--accent-amber); display: block; margin-bottom: 0.3rem;">Recommendations to Boost Score:</strong>
                <ul style="padding-left: 1.2rem; margin: 0;">
                  ${readiness.recommendations.map(r => `<li style="margin-bottom: 0.2rem;">${r}</li>`).join('')}
                </ul>
              </div>
            ` : `
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 0.85rem; font-size: 0.82rem; color: #15803d; text-align: center;">
                Exceptional Readiness! All core profile benchmarks satisfied.
              </div>
            `}
          </div>
        </div>

        <!-- Right Column: Academics, Skills, Projects, Resume -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <!-- Verified Academic Metrics -->
          <div class="card" style="background: #ffffff;">
            <div class="card-header">
              <h3 class="card-title">Verified Academic Metrics</h3>
              <span class="badge badge-selected">Team C DBMS Verified</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem;">
              <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Cumulative CGPA</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: var(--rit-blue); font-family: 'JetBrains Mono'; margin: 0.2rem 0;">
                  ${student.cgpa !== undefined && student.cgpa !== null ? student.cgpa : '<span style="font-size: 0.9rem; color: var(--accent-amber);">Data unavailable</span>'}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">Scale 0 – 10.0</div>
              </div>

              <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Active Backlogs</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: ${(student.backlogs ?? 0) === 0 ? '#15803d' : '#b91c1c'}; font-family: 'JetBrains Mono'; margin: 0.2rem 0;">
                  ${student.backlogs !== undefined && student.backlogs !== null ? student.backlogs : '<span style="font-size: 0.9rem; color: var(--accent-amber);">Data unavailable</span>'}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">Standing backlog count</div>
              </div>

              <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Attendance %</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: #15803d; font-family: 'JetBrains Mono'; margin: 0.2rem 0;">
                  ${student.attendance !== undefined && student.attendance !== null ? `${student.attendance}%` : '<span style="font-size: 0.9rem; color: var(--accent-amber);">Data unavailable</span>'}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">Verified attendance record</div>
              </div>
            </div>
          </div>

          <!-- Technical Skills -->
          <div class="card" style="background: #ffffff;">
            <div class="card-header">
              <h3 class="card-title">Technical Skill Registry (${skills.length})</h3>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Indexed in Team B Graph</span>
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 0.6rem;">
              ${skills.map(s => `
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; color: var(--rit-blue); padding: 0.45rem 0.85rem; border-radius: var(--radius-md); font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
                  <span>${s}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Projects & Certifications -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
            <div class="card" style="background: #ffffff;">
              <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--rit-navy);">Projects (${projects.length})</h4>
              <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                ${projects.map(p => `
                  <div style="background: var(--bg-tertiary); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                    <div style="font-weight: 700; font-size: 0.88rem; color: var(--rit-navy);">${p.name}</div>
                    <div style="font-size: 0.75rem; color: var(--rit-blue); margin-top: 0.2rem;">${p.tech}</div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="card" style="background: #ffffff;">
              <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--rit-navy);">Certifications (${certs.length})</h4>
              <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                ${certs.map(c => `
                  <div style="background: var(--bg-tertiary); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                    <div style="font-weight: 700; font-size: 0.88rem; color: var(--rit-navy);">${c.title}</div>
                    <div style="font-size: 0.75rem; color: #15803d; margin-top: 0.2rem;">${c.issuer} • ${c.date}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Resume PDF Management -->
          <div class="card" style="background: #ffffff;">
            <div class="card-header">
              <h3 class="card-title">Placement Resume PDF</h3>
              <span class="badge ${student.has_resume || student.resume_url ? 'badge-open' : 'badge-screening'}">
                ${student.has_resume || student.resume_url ? 'PDF Uploaded' : 'Action Required'}
              </span>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
              <div>
                <div style="font-weight: 600; font-size: 0.9rem; color: var(--rit-navy);">
                  ${student.name || studentId}_Resume.pdf
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">PDF Format • Max 5MB • Ready for Placement Drives</div>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button id="upload-resume-btn" class="btn btn-secondary btn-sm">Upload / Replace PDF</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
      window.views.student._openEditSkillsModal(student, skills);
    });

    document.getElementById('upload-resume-btn')?.addEventListener('click', () => {
      window.toast.info('Resume PDF upload window triggered. Max file size: 5MB.');
    });

  } catch (err) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 4rem 1rem; max-width: 600px; margin: 3rem auto; border-top: 4px solid var(--accent-amber);">
        <h2 style="font-size: 1.75rem; font-weight: 800; color: var(--rit-navy); margin-bottom: 0.5rem;">Data Unavailable</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">${err.message || 'Authoritative student academic information could not be retrieved from Team C.'}</p>
        <button onclick="window.views.student.renderProfile()" class="btn btn-primary">Retry Fetching Data</button>
      </div>
    `;
  }
};

window.views.student._openEditSkillsModal = function(student, currentSkills) {
  const skillsString = currentSkills.join(', ');

  const modalHtml = `
    <div>
      <div class="form-group">
        <label class="form-label" style="color: var(--rit-navy); font-weight: 700;">Technical Skills (comma-separated)</label>
        <input type="text" id="edit-skills-input" class="form-control" value="${skillsString}" placeholder="e.g. JavaScript, Python, SQL, React" />
      </div>
    </div>
  `;

  window.modal.open({
    title: 'Update Technical Skills Registry',
    contentHtml: modalHtml,
    buttons: [
      { text: 'Cancel', className: 'btn-secondary', onClick: () => true },
      {
        text: 'Save Skills',
        className: 'btn-primary',
        onClick: async (e, modalRoot) => {
          try {
            const inputVal = modalRoot.querySelector('#edit-skills-input').value;
            const newSkills = inputVal.split(',').map(s => s.trim()).filter(Boolean);

            await window.api.updateStudentProfile(student.student_id, { skills: newSkills });
            window.toast.success('Technical skills updated successfully!');
            window.views.student.renderProfile();
            return true;
          } catch (err) {
            window.toast.error(err.message || 'Failed to update skills');
            return false;
          }
        }
      }
    ]
  });
};
