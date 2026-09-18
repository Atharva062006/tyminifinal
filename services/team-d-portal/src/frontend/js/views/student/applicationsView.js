/**
 * Student Applications List & Status Pipeline View for Team D Frontend.
 * Clean RIT Institutional Design Theme.
 */

window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderApplications = async function() {
  const container = document.getElementById('main-content');
  container.innerHTML = window.components.renderLoading('Fetching your placement applications...');

  try {
    const user = window.store.get('user') || {};
    const apps = await window.api.getApplications({ student_id: user.id });

    // Pipeline counts
    const stageCounts = {
      APPLIED: 0,
      SCREENING: 0,
      RULE_EVALUATED: 0,
      SHORTLISTED: 0,
      INTERVIEW_SCHEDULED: 0,
      SELECTED: 0,
      OFFER_ISSUED: 0
    };

    apps.forEach(app => {
      const state = app.state || 'APPLIED';
      if (stageCounts[state] !== undefined) stageCounts[state]++;
    });

    const tableHtml = window.components.renderDataTable({
      columns: [
        {
          label: 'Company',
          render: row => `<strong style="color: var(--rit-navy);">${row.company_name || 'Company'}</strong>`
        },
        {
          label: 'Role',
          render: row => `<strong>${row.drive_title}</strong><br><span style="font-size: 0.72rem; color: var(--text-muted); font-family: 'JetBrains Mono';">${row.application_id}</span>`
        },
        {
          label: 'Applied Date',
          render: row => row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'
        },
        {
          label: 'Current Status',
          render: row => window.components.renderBadge(row.state)
        },
        {
          label: 'Interview',
          render: row => row.state === 'INTERVIEW_SCHEDULED' 
            ? `<span class="badge badge-interview_scheduled">SCHEDULED</span>`
            : `<span style="color: var(--text-muted); font-size: 0.8rem;">—</span>`
        },
        {
          label: 'Offer',
          render: row => ['OFFER_ISSUED', 'OFFER_ACCEPTED'].includes(row.state)
            ? `<span class="badge badge-offer_issued">ISSUED</span>`
            : `<span style="color: var(--text-muted); font-size: 0.8rem;">—</span>`
        },
        {
          label: 'Action',
          render: row => `
            <a href="#/student/applications/${row.application_id}" class="btn btn-secondary btn-sm">
              Track Status →
            </a>
          `
        }
      ],
      rows: apps,
      emptyMessage: 'You have not submitted any placement applications yet.'
    });

    container.innerHTML = `
      <!-- Breadcrumb -->
      <div id="breadcrumb-bar" style="margin-bottom: 1.25rem;">
        <span style="color: var(--text-muted);">Home</span> / <strong style="color: var(--rit-navy);">My Applications</strong>
      </div>

      <!-- Page Header -->
      <div style="margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--rit-navy); margin-bottom: 0.25rem;">My Placement Applications</h1>
            <p style="color: var(--text-secondary); font-size: 0.92rem;">Track real-time lifecycle state transitions across Team A, Team B, and Team C.</p>
          </div>
          <a href="#/student/drives" class="btn btn-primary">+ Apply to New Drive</a>
        </div>
      </div>

      <!-- Status Pipeline Overview Banner -->
      <div class="card" style="margin-bottom: 1.75rem;">
        <div class="card-header">
          <h3 class="card-title">Application Status Pipeline Overview</h3>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Authoritative Team C State Progression</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; overflow-x: auto; padding: 0.5rem 0;">
          <div style="flex: 1; text-align: center; background: var(--bg-tertiary); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--rit-navy);">${stageCounts.APPLIED}</div>
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); margin-top: 0.2rem;">APPLIED</div>
          </div>
          <span style="color: var(--text-muted);">→</span>
          <div style="flex: 1; text-align: center; background: var(--bg-tertiary); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--rit-navy);">${stageCounts.SCREENING}</div>
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); margin-top: 0.2rem;">SCREENING</div>
          </div>
          <span style="color: var(--text-muted);">→</span>
          <div style="flex: 1; text-align: center; background: var(--bg-tertiary); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--rit-navy);">${stageCounts.RULE_EVALUATED}</div>
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); margin-top: 0.2rem;">RULE EVALUATED</div>
          </div>
          <span style="color: var(--text-muted);">→</span>
          <div style="flex: 1; text-align: center; background: var(--bg-tertiary); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--rit-blue);">${stageCounts.SHORTLISTED}</div>
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--rit-blue); margin-top: 0.2rem;">SHORTLISTED</div>
          </div>
          <span style="color: var(--text-muted);">→</span>
          <div style="flex: 1; text-align: center; background: var(--bg-tertiary); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--accent-amber);">${stageCounts.INTERVIEW_SCHEDULED}</div>
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--accent-amber); margin-top: 0.2rem;">INTERVIEW</div>
          </div>
          <span style="color: var(--text-muted);">→</span>
          <div style="flex: 1; text-align: center; background: var(--bg-tertiary); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--accent-emerald);">${stageCounts.SELECTED}</div>
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--accent-emerald); margin-top: 0.2rem;">SELECTED</div>
          </div>
          <span style="color: var(--text-muted);">→</span>
          <div style="flex: 1; text-align: center; background: #dcfce7; padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid #bbf7d0;">
            <div style="font-size: 1.1rem; font-weight: 800; color: #15803d;">${stageCounts.OFFER_ISSUED}</div>
            <div style="font-size: 0.7rem; font-weight: 700; color: #15803d; margin-top: 0.2rem;">OFFER ISSUED</div>
          </div>
        </div>
      </div>

      <!-- Applications Data Table Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Submitted Applications (${apps.length})</h3>
        </div>
        ${tableHtml}
      </div>
    `;

  } catch (err) {
    container.innerHTML = window.components.renderError(err, "window.views.student.renderApplications()");
  }
};
