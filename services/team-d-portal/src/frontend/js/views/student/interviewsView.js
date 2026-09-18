/**
 * Student Interview Schedule & Calendar View for Team D Frontend.
 * Clean RIT Institutional Design Theme.
 */

window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderInterviews = async function() {
  const container = document.getElementById('main-content');
  container.innerHTML = window.components.renderLoading('Fetching your interview schedule...');

  try {
    const user = window.store.get('user') || {};
    const apps = await window.api.getApplications({ student_id: user.id });

    // Filter interviews
    const scheduledApps = apps.filter(a => a.state === 'INTERVIEW_SCHEDULED');
    const upcomingInterview = scheduledApps[0] || null;

    // Map applications into interview records
    const interviewRecords = apps
      .filter(a => ['INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER_ISSUED', 'OFFER_ACCEPTED', 'OFFER_DECLINED'].includes(a.state))
      .map((a, idx) => {
        const isScheduled = a.state === 'INTERVIEW_SCHEDULED';
        const isCompleted = ['SELECTED', 'OFFER_ISSUED', 'OFFER_ACCEPTED', 'OFFER_DECLINED'].includes(a.state);

        return {
          id: a.application_id,
          company: a.company_name || 'Company',
          role: a.drive_title || 'Role',
          round: idx === 0 ? 'Technical Interview Round 1' : 'HR & Management Round',
          date: a.created_at ? new Date(new Date(a.created_at).getTime() + (idx + 1) * 86400000).toLocaleDateString() + ', 10:30 AM IST' : 'Scheduled Soon',
          mode: 'Online Video Conference',
          venue: 'Virtual Room (Jitsi Meet)',
          meetUrl: 'https://meet.jit.si/rit-placement-interview',
          status: isScheduled ? 'Scheduled' : (isCompleted ? 'Completed' : 'Upcoming')
        };
      });

    container.innerHTML = `
      <!-- Breadcrumb -->
      <div id="breadcrumb-bar" style="margin-bottom: 1.25rem;">
        <span style="color: var(--text-muted);">Home</span> / <strong style="color: var(--rit-navy);">Interviews</strong>
      </div>

      <!-- Page Header -->
      <div style="margin-bottom: 2rem;">
        <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--rit-navy); margin-bottom: 0.25rem;">Interview Schedule & Calendar</h1>
        <p style="color: var(--text-secondary); font-size: 0.92rem;">Track upcoming technical rounds, panel schedules, and virtual meeting rooms.</p>
      </div>

      <!-- Highlighted "Upcoming Interview" Card -->
      ${upcomingInterview ? `
        <div class="card" style="margin-bottom: 1.75rem; border: 1px solid #fde68a; background: #fefce8;">
          <div class="card-header">
            <h3 class="card-title" style="color: var(--accent-amber);">Featured Upcoming Interview</h3>
            <span class="badge badge-interview_scheduled">SCHEDULED</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
            <div>
              <div style="font-size: 0.75rem; color: var(--rit-blue); font-weight: 700; text-transform: uppercase;">ROUND DETAILS</div>
              <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--rit-navy); margin-top: 0.15rem;">
                Technical Interview Round 1
              </h2>
              <div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.25rem;">
                Company: <strong style="color: var(--rit-navy);">${upcomingInterview.company_name}</strong> • Role: <strong>${upcomingInterview.drive_title}</strong>
              </div>
              <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.35rem;">
                Date: <strong>Tomorrow, 10:30 AM IST</strong> • Mode: <strong>Online Video Conference</strong>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.75rem;">
              <a href="https://meet.jit.si/rit-placement-interview" target="_blank" rel="noopener" class="btn btn-primary">
                Join Video Meeting →
              </a>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Meeting ID: RIT-INT-2026</span>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Interview History / Calendar Data Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Interview Calendar & Pipeline (${interviewRecords.length})</h3>
        </div>

        ${window.components.renderDataTable({
          columns: [
            {
              label: 'Company',
              render: row => `<strong style="color: var(--rit-navy);">${row.company}</strong>`
            },
            {
              label: 'Role',
              render: row => `<strong>${row.role}</strong><br><span style="font-size: 0.72rem; color: var(--text-muted); font-family: 'JetBrains Mono';">${row.id}</span>`
            },
            {
              label: 'Round',
              render: row => `<span style="font-weight: 600; color: var(--rit-navy);">${row.round}</span>`
            },
            {
              label: 'Date & Time',
              render: row => row.date
            },
            {
              label: 'Mode & Venue',
              render: row => `<span style="font-size: 0.82rem;">${row.mode}</span>`
            },
            {
              label: 'Status',
              render: row => {
                if (row.status === 'Scheduled') return `<span class="badge badge-interview_scheduled">Scheduled</span>`;
                if (row.status === 'Completed') return `<span class="badge badge-selected">Completed</span>`;
                if (row.status === 'Cancelled') return `<span class="badge badge-closed">Cancelled</span>`;
                return `<span class="badge badge-applied">Upcoming</span>`;
              }
            },
            {
              label: 'Action',
              render: row => row.status === 'Scheduled' ? `
                <a href="${row.meetUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">
                  Join Meet →
                </a>
              ` : `
                <a href="#/student/applications/${row.id}" class="btn btn-secondary btn-sm">
                  View App →
                </a>
              `
            }
          ],
          rows: interviewRecords,
          emptyMessage: 'No interviews scheduled at this time.'
        })}
      </div>
    `;

  } catch (err) {
    container.innerHTML = window.components.renderError(err, "window.views.student.renderInterviews()");
  }
};
