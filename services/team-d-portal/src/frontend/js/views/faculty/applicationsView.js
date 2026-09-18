/**
 * Faculty Applications Management View for Team D Frontend.
 */

window.views = window.views || {};
window.views.faculty = window.views.faculty || {};

window.views.faculty.renderApplications = async function() {
  const container = document.getElementById('main-content');
  container.innerHTML = window.components.renderLoading('Loading all campus applications...');

  try {
    const [apps, drives] = await Promise.all([
      window.api.getApplications(),
      window.api.getDrives()
    ]);

    container.innerHTML = `
      <div style="margin-bottom: 2rem;">
        <h1 style="font-size: 1.75rem; font-weight: 800; margin-bottom: 0.25rem;">Candidate Application Master Registry</h1>
        <p style="color: var(--text-secondary); font-size: 0.9rem;">Authoritative applications submitted to Team C across all placement drives.</p>
      </div>

      <div class="filter-bar">
        <div style="flex: 2; min-width: 200px;">
          <input type="text" id="faculty-app-search" class="form-control" placeholder="Search applicant ID or drive title..." />
        </div>
        <div style="flex: 1; min-width: 140px;">
          <select id="faculty-drive-filter" class="form-control">
            <option value="">All Drives</option>
            ${drives.map(d => `<option value="${d.drive_id}">${d.title}</option>`).join('')}
          </select>
        </div>
        <div style="flex: 1; min-width: 140px;">
          <select id="faculty-state-filter" class="form-control">
            <option value="">All Lifecycle States</option>
            <option value="APPLIED">APPLIED</option>
            <option value="SCREENING">SCREENING</option>
            <option value="RULE_EVALUATED">RULE_EVALUATED</option>
            <option value="SHORTLISTED">SHORTLISTED</option>
            <option value="INTERVIEW_SCHEDULED">INTERVIEW_SCHEDULED</option>
            <option value="SELECTED">SELECTED</option>
            <option value="OFFER_ISSUED">OFFER_ISSUED</option>
            <option value="NOT_ELIGIBLE">NOT_ELIGIBLE</option>
            <option value="WAITLISTED">WAITLISTED</option>
            <option value="WITHDRAWN">WITHDRAWN</option>
          </select>
        </div>
      </div>

      <div class="card">
        <div id="faculty-apps-table-container">
          ${window.views.faculty._renderAppsTable(apps)}
        </div>
      </div>
    `;

    const searchInput = document.getElementById('faculty-app-search');
    const driveFilter = document.getElementById('faculty-drive-filter');
    const stateFilter = document.getElementById('faculty-state-filter');

    const filterApps = () => {
      const q = searchInput.value.toLowerCase().trim();
      const driveId = driveFilter.value;
      const state = stateFilter.value;

      const filtered = apps.filter(a => {
        const matchesQuery = !q || (a.student_id && a.student_id.toLowerCase().includes(q)) || (a.drive_title && a.drive_title.toLowerCase().includes(q)) || (a.application_id && a.application_id.toLowerCase().includes(q));
        const matchesDrive = !driveId || a.drive_id === driveId;
        const matchesState = !state || a.state === state;
        return matchesQuery && matchesDrive && matchesState;
      });

      document.getElementById('faculty-apps-table-container').innerHTML = window.views.faculty._renderAppsTable(filtered);
    };

    searchInput.addEventListener('input', filterApps);
    driveFilter.addEventListener('change', filterApps);
    stateFilter.addEventListener('change', filterApps);

  } catch (err) {
    container.innerHTML = window.components.renderError(err, "window.views.faculty.renderApplications()");
  }
};

window.views.faculty._renderAppsTable = function(apps) {
  return window.components.renderDataTable({
    columns: [
      { label: 'Application ID', render: row => `<span class="mono" style="color: var(--accent-cyan); font-size: 0.8rem;">${row.application_id}</span>` },
      { label: 'Student ID', render: row => `<strong>${row.student_id}</strong>` },
      { label: 'Drive / Company', render: row => `<strong>${row.drive_title}</strong><br><span style="font-size: 0.75rem; color: var(--text-muted);">${row.company_name}</span>` },
      { label: 'Package', render: row => row.package ? `₹${(row.package / 100000).toFixed(1)} LPA` : '—' },
      { label: 'State', render: row => window.components.renderBadge(row.state) },
      { label: 'Submitted', render: row => row.created_at ? new Date(row.created_at).toLocaleDateString() : '—' }
    ],
    rows: apps,
    emptyMessage: 'No applications found matching criteria.'
  });
};
