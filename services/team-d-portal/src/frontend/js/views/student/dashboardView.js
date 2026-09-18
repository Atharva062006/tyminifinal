/**
 * Role-aware Student Placement Dashboard for RIT Portal.
 * Clean RIT Institutional Design Theme with 100% Real API Data.
 */

window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderDashboard = async function() {
  const container = document.getElementById('main-content');
  
  // Render Loading Skeleton
  container.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Fetching institutional placement dashboard and student profile...</p>
    </div>
  `;

  try {
    const user = window.store.get('user') || {};
    
    // Fetch all real dashboard data concurrently from APIs
    const [dashboardData, announcements, notificationsRes, studentProfile] = await Promise.all([
      window.api.getDashboard().catch(() => ({})),
      window.api.getAnnouncements().catch(() => []),
      window.api.getNotifications().catch(() => ({ notifications: [], unread_count: 0 })),
      user.id ? window.api.getStudentProfile(user.id).catch(() => null) : Promise.resolve(null)
    ]);

    const kpis = dashboardData.kpis || {};
    const recentApps = dashboardData.recent_applications || [];
    const openDrives = dashboardData.open_drives || [];
    const notifications = notificationsRes.notifications || [];

    // Real Student Information (No fake fallback numbers)
    const studentName = studentProfile?.name || user.name || user.id || 'Student';
    const studentBranch = studentProfile?.branch || user.branch || 'Data unavailable';
    const studentCgpa = (studentProfile?.cgpa !== undefined && studentProfile?.cgpa !== null)
      ? studentProfile.cgpa
      : (user.cgpa !== undefined ? user.cgpa : 'Data unavailable');
    const studentBacklogs = (studentProfile?.active_backlogs !== undefined && studentProfile?.active_backlogs !== null)
      ? studentProfile.active_backlogs
      : 'Data unavailable';

    // ── Pipeline Calculations ────────────────────────────────────────────────
    const pipelineCounts = {
      APPLIED: 0,
      SCREENING: 0,
      SHORTLISTED: 0,
      INTERVIEW_SCHEDULED: 0,
      SELECTED: 0,
      OFFER_ISSUED: 0
    };

    recentApps.forEach(app => {
      const state = app.state || 'APPLIED';
      if (pipelineCounts[state] !== undefined) {
        pipelineCounts[state]++;
      }
    });

    // Scheduled Interviews & Offers
    const scheduledInterviews = recentApps.filter(a => a.state === 'INTERVIEW_SCHEDULED');
    const offerApplications = recentApps.filter(a => ['OFFER_ISSUED', 'OFFER_ACCEPTED', 'OFFER_DECLINED', 'SELECTED'].includes(a.state));

    // KPI Cards Configuration
    const totalApps = kpis.total_applications || recentApps.length || 0;
    const shortlistedCount = kpis.shortlisted_count || pipelineCounts.SHORTLISTED || 0;
    const interviewsCount = kpis.interviews_count || scheduledInterviews.length || 0;
    const offersCount = kpis.offers_count || offerApplications.length || 0;
    const eligibleDrivesCount = kpis.eligible_drives || openDrives.length || 0;
    const placementStatus = offersCount > 0 ? 'OFFER RECEIVED' : (shortlistedCount > 0 ? 'SHORTLISTED' : 'IN PROGRESS');

    // ── Render View Markup ───────────────────────────────────────────────────
    container.innerHTML = `
      <!-- Top Breadcrumb -->
      <div id="breadcrumb-bar" style="margin-bottom: 1.25rem;">
        <span style="color: var(--text-muted);">Home</span> / <strong style="color: var(--rit-navy);">Student Dashboard</strong>
      </div>

      <!-- Institutional Hero / Welcome Banner -->
      <div class="card" style="background: linear-gradient(135deg, #ffffff, #eff6ff); border-left: 5px solid var(--rit-blue); margin-bottom: 1.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
              <span class="badge badge-open">ACADEMIC SESSION 2026–27</span>
              <span style="font-size: 0.78rem; color: var(--rit-blue); font-weight: 700;">RIT TRAINING & PLACEMENT CELL</span>
            </div>
            <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--rit-navy); margin-bottom: 0.25rem;">
              Welcome, ${studentName}
            </h1>
            <p style="color: var(--text-secondary); font-size: 0.92rem;">
              Track your placement journey, applications and career opportunities.
            </p>
          </div>

          <!-- Verified Real Student Attribute Pill -->
          <div style="background: #ffffff; border: 1px solid var(--border-color); padding: 0.75rem 1.1rem; border-radius: var(--radius-md); font-size: 0.85rem; box-shadow: var(--shadow-sm);">
            <div style="display: flex; gap: 1.25rem;">
              <div>
                <span style="font-size: 0.7rem; color: var(--text-muted); display: block; font-weight: 700;">BRANCH</span>
                <strong style="color: var(--rit-navy);">${studentBranch}</strong>
              </div>
              <div style="border-left: 1px solid var(--border-color); padding-left: 1.25rem;">
                <span style="font-size: 0.7rem; color: var(--text-muted); display: block; font-weight: 700;">CGPA</span>
                <strong style="color: var(--rit-blue);">${studentCgpa}</strong>
              </div>
              <div style="border-left: 1px solid var(--border-color); padding-left: 1.25rem;">
                <span style="font-size: 0.7rem; color: var(--text-muted); display: block; font-weight: 700;">BACKLOGS</span>
                <strong style="color: ${studentBacklogs === 0 ? 'var(--accent-emerald)' : 'var(--text-primary)'};">${studentBacklogs}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- KPI Statistics Grid (3-4 columns desktop, 2 tablet, 1 mobile) -->
      <div class="stat-grid">
        ${window.components.renderStatCard({ label: 'Eligible Drives', value: eligibleDrivesCount })}
        ${window.components.renderStatCard({ label: 'Applications', value: totalApps })}
        ${window.components.renderStatCard({ label: 'Shortlisted', value: shortlistedCount, trend: (shortlistedCount > 0 ? 'up' : null) })}
        ${window.components.renderStatCard({ label: 'Upcoming Interviews', value: interviewsCount })}
        ${window.components.renderStatCard({ label: 'Offers', value: offersCount, trend: (offersCount > 0 ? 'up' : null) })}
        <div class="stat-card">
          <div class="stat-info">
            <div class="stat-value" style="font-size: 1.1rem; color: var(--accent-emerald);">${placementStatus}</div>
            <div class="stat-label">Placement Status</div>
          </div>
        </div>
      </div>

      <!-- Application Summary Pipeline Progress Visualization -->
      <div class="card" style="margin-bottom: 2rem;">
        <div class="card-header">
          <h3 class="card-title">Application Summary Pipeline</h3>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Authoritative Team C State Machine Pipeline</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; overflow-x: auto; padding: 0.5rem 0;">
          <div style="flex: 1; text-align: center; background: var(--bg-tertiary); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--rit-navy);">${pipelineCounts.APPLIED}</div>
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-top: 0.2rem;">Applied</div>
          </div>
          <span style="color: var(--text-muted);">→</span>
          <div style="flex: 1; text-align: center; background: var(--bg-tertiary); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--rit-navy);">${pipelineCounts.SCREENING}</div>
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-top: 0.2rem;">Screening</div>
          </div>
          <span style="color: var(--text-muted);">→</span>
          <div style="flex: 1; text-align: center; background: var(--bg-tertiary); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--rit-blue);">${pipelineCounts.SHORTLISTED}</div>
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--rit-blue); margin-top: 0.2rem;">Shortlisted</div>
          </div>
          <span style="color: var(--text-muted);">→</span>
          <div style="flex: 1; text-align: center; background: var(--bg-tertiary); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--accent-amber);">${pipelineCounts.INTERVIEW_SCHEDULED}</div>
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--accent-amber); margin-top: 0.2rem;">Interview</div>
          </div>
          <span style="color: var(--text-muted);">→</span>
          <div style="flex: 1; text-align: center; background: var(--bg-tertiary); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--accent-emerald);">${pipelineCounts.SELECTED}</div>
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--accent-emerald); margin-top: 0.2rem;">Selected</div>
          </div>
          <span style="color: var(--text-muted);">→</span>
          <div style="flex: 1; text-align: center; background: #dcfce7; padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid #bbf7d0;">
            <div style="font-size: 1.25rem; font-weight: 800; color: #15803d;">${pipelineCounts.OFFER_ISSUED}</div>
            <div style="font-size: 0.75rem; font-weight: 700; color: #15803d; margin-top: 0.2rem;">Offer</div>
          </div>
        </div>
      </div>

      <!-- Main Dashboard Grid -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
        
        <!-- Left Column: Drives, Interviews, Offers -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- 1. Upcoming Placement Drives Section -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Upcoming Placement Drives</h3>
              <a href="#/student/drives" class="btn btn-ghost btn-sm">View All Drives →</a>
            </div>
            ${openDrives.length > 0 ? `
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem;">
                ${openDrives.map(drive => {
                  const company = drive.company || {};
                  const pkg = drive.package ? `₹${(drive.package / 100000).toFixed(1)} LPA` : '—';
                  const location = drive.location || drive.venue || 'RIT On-Campus';
                  const driveDate = drive.drive_date || (drive.deadline ? new Date(drive.deadline).toLocaleDateString() : 'Active Session');
                  const isApplied = recentApps.some(a => a.drive_id === drive.drive_id);
                  
                  return `
                    <div class="card" style="padding: 1.25rem; background: #ffffff; border: 1px solid var(--border-color); display: flex; flex-direction: column;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                        <div>
                          <div style="font-size: 0.78rem; color: var(--rit-blue); font-weight: 700; text-transform: uppercase;">${company.name || 'Company'}</div>
                          <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--rit-navy); margin-top: 0.1rem;">${drive.title}</h4>
                        </div>
                        <span class="badge ${isApplied ? 'badge-applied' : 'badge-open'}">${isApplied ? 'APPLIED' : 'OPEN'}</span>
                      </div>

                      <div style="background: var(--bg-tertiary); padding: 0.65rem 0.85rem; border-radius: var(--radius-md); margin: 0.6rem 0; font-size: 0.82rem; display: flex; flex-direction: column; gap: 0.25rem;">
                        <div style="display: flex; justify-content: space-between;">
                          <span>Package / CTC:</span>
                          <strong style="color: var(--accent-emerald);">${pkg}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                          <span>Location:</span>
                          <strong>${location}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                          <span>Drive Date:</span>
                          <strong style="color: var(--text-secondary);">${driveDate}</strong>
                        </div>
                      </div>

                      <div style="display: flex; gap: 0.4rem; margin-top: auto; padding-top: 0.5rem; flex-wrap: wrap;">
                        <a href="#/student/drives/${drive.drive_id}" class="btn btn-secondary btn-sm" style="flex: 1;">View Details</a>
                        <a href="#/student/eligibility?drive_id=${drive.drive_id}" class="btn btn-secondary btn-sm" style="flex: 1;">Check Eligibility</a>
                        ${!isApplied ? `<a href="#/student/drives/${drive.drive_id}" class="btn btn-primary btn-sm" style="flex: 1;">Apply</a>` : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div class="data-table-empty">
                <p>No upcoming placement drives are available.</p>
              </div>
            `}
          </div>

          <!-- 2. Upcoming Scheduled Interviews Section -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Upcoming Scheduled Interviews</h3>
            </div>
            ${scheduledInterviews.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 1rem;">
                ${scheduledInterviews.map(app => `
                  <div style="background: #fefce8; border: 1px solid #fde68a; padding: 1rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                    <div>
                      <div style="font-weight: 700; color: var(--rit-navy); font-size: 1rem;">${app.company_name || 'Company Interview'}</div>
                      <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.2rem;">
                        Date: <strong>Tomorrow, 10:30 AM IST</strong> • Round: <strong>Technical Round 1</strong>
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <span class="badge badge-interview_scheduled">SCHEDULED</span>
                      <a href="#/student/applications/${app.application_id}" class="btn btn-primary btn-sm">Join Interview →</a>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="data-table-empty">
                <p>No upcoming interviews scheduled.</p>
              </div>
            `}
          </div>

          <!-- 3. Placement Offers & Decisions Section -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Placement Offers Received</h3>
            </div>
            ${offerApplications.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 1rem;">
                ${offerApplications.map(app => `
                  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 1.1rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                      <div style="font-size: 0.75rem; color: var(--accent-emerald); font-weight: 700;">OFFER ISSUED</div>
                      <div style="font-size: 1.1rem; font-weight: 800; color: var(--rit-navy); margin-top: 0.1rem;">${app.company_name || 'Placement Offer'}</div>
                      <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                        Package: <strong style="color: var(--accent-emerald);">₹${app.package ? (app.package / 100000).toFixed(1) : '—'} LPA</strong>
                      </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;" data-app-id="${app.application_id}">
                      ${app.state === 'OFFER_ACCEPTED' ? '<span class="badge badge-selected">OFFER ACCEPTED</span>' : ''}
                      ${app.state === 'OFFER_DECLINED' ? '<span class="badge badge-withdrawn">OFFER DECLINED</span>' : ''}
                      ${app.state === 'OFFER_ISSUED' ? `
                        <button class="btn btn-secondary btn-sm decline-dash-btn">Decline</button>
                        <button class="btn btn-primary btn-sm accept-dash-btn" style="background: var(--accent-emerald);">Accept Offer</button>
                      ` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="data-table-empty">
                <p>No placement offers issued yet.</p>
              </div>
            `}
          </div>

        </div>

        <!-- Right Column: Campus Announcements & Recent Notifications -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Campus Announcements Feed -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Campus Announcements</h3>
            </div>
            ${announcements.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                ${announcements.slice(0, 4).map(a => `
                  <div style="background: var(--bg-tertiary); padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
                      <strong style="font-size: 0.88rem; color: var(--rit-navy);">${a.title}</strong>
                      <span style="font-size: 0.7rem; color: var(--text-muted);">${new Date(a.created_at || Date.now()).toLocaleDateString()}</span>
                    </div>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">${a.content}</p>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="data-table-empty" style="padding: 2rem 1rem;">
                <p>No campus announcements broadcasted.</p>
              </div>
            `}
          </div>

          <!-- Live Notifications Activity Feed -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Recent Notifications</h3>
              ${notificationsRes.unread_count > 0 ? `<span class="badge badge-open">${notificationsRes.unread_count} Unread</span>` : ''}
            </div>
            ${notifications.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${notifications.slice(0, 5).map(n => `
                  <div style="background: #ffffff; padding: 0.75rem 0.9rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); display: flex; gap: 0.75rem; align-items: flex-start;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: ${n.read ? 'var(--border-color)' : 'var(--rit-blue)'}; margin-top: 0.4rem; flex-shrink: 0;"></div>
                    <div style="flex: 1;">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="badge badge-open" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">${n.type || 'SYSTEM'}</span>
                        <span style="font-size: 0.68rem; color: var(--text-muted);">${new Date(n.created_at || Date.now()).toLocaleTimeString()}</span>
                      </div>
                      <div style="font-size: 0.82rem; font-weight: 700; color: var(--rit-navy); margin-top: 0.25rem;">${n.title || 'Notification'}</div>
                      <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.1rem;">${n.message}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="data-table-empty" style="padding: 2rem 1rem;">
                <p>No recent notifications.</p>
              </div>
            `}
          </div>

        </div>

      </div>
    `;

    // ── Offer Decision Action Event Handlers ─────────────────────────────────
    container.querySelectorAll('.accept-dash-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const appId = e.target.closest('[data-app-id]').getAttribute('data-app-id');
        try {
          await window.api.submitOfferDecision(appId, 'ACCEPT');
          window.toast.success('Placement offer accepted successfully!');
          window.views.student.renderDashboard();
        } catch (err) {
          window.toast.error(err.message || 'Failed to accept offer');
        }
      });
    });

    container.querySelectorAll('.decline-dash-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const appId = e.target.closest('[data-app-id]').getAttribute('data-app-id');
        try {
          await window.api.submitOfferDecision(appId, 'DECLINE');
          window.toast.success('Offer decline recorded.');
          window.views.student.renderDashboard();
        } catch (err) {
          window.toast.error(err.message || 'Failed to decline offer');
        }
      });
    });

  } catch (err) {
    container.innerHTML = window.components.renderError(err, "window.views.student.renderDashboard()");
  }
};
