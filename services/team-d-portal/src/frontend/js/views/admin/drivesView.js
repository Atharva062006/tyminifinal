/**
 * Admin Drive & Company Management View for Team D Frontend.
 * Clean RIT Institutional Design Theme.
 */

window.views = window.views || {};
window.views.admin = window.views.admin || {};

window.views.admin.renderDrives = async function() {
  const container = document.getElementById('main-content');
  container.innerHTML = window.components.renderLoading('Loading placement drives administration...');

  try {
    const drives = await window.api.getDrives();
    const companies = await window.api.getCompanies();

    const tableHtml = window.components.renderDataTable({
      columns: [
        { label: 'Drive ID', render: r => `<span class="mono" style="font-size: 0.75rem; color: var(--rit-blue); font-weight: 700;">${r.drive_id}</span>` },
        { label: 'Company & Role', render: r => `<strong style="color: var(--rit-navy);">${r.company?.name || 'Company'}</strong><br><span>${r.title}</span>` },
        { label: 'Seats', render: r => `<strong>${r.seats}</strong>` },
        { label: 'Package', render: r => r.package ? `₹${(r.package / 100000).toFixed(1)} LPA` : '—' },
        { label: 'Min CGPA', render: r => `<span style="font-weight: 600;">${r.criteria?.min_cgpa ?? '—'}</span>` },
        { label: 'State', render: r => window.components.renderBadge(r.state) },
        {
          label: 'Action',
          render: r => `
            <button class="btn btn-secondary btn-sm edit-drive-btn" data-drive-id="${r.drive_id}">
              Edit Drive
            </button>
          `
        }
      ],
      rows: drives,
      emptyMessage: 'No drives registered.'
    });

    // Company Listing Table
    const companyTableHtml = window.components.renderDataTable({
      columns: [
        { label: 'Company ID', render: c => `<span class="mono" style="font-size: 0.75rem; color: var(--rit-blue); font-weight: 700;">${c.company_id}</span>` },
        { label: 'Company Name', render: c => `<strong style="color: var(--rit-navy);">${c.name}</strong>` },
        { label: 'Industry Domain', render: c => c.industry || 'Technology' },
        { label: 'Tier Category', render: c => `<span class="badge badge-selected">${c.tier || 'Tier-1'}</span>` },
        { label: 'Active Drives', render: c => `<strong>${drives.filter(d => d.company_id === c.company_id || d.company?.id === c.company_id).length} Drives</strong>` }
      ],
      rows: companies,
      emptyMessage: 'No registered partner companies.'
    });

    container.innerHTML = `
      <!-- Breadcrumb -->
      <div id="breadcrumb-bar" style="margin-bottom: 1.25rem;">
        <span style="color: var(--text-muted);">Home</span> / <a href="#/admin/dashboard" style="color: var(--text-muted); text-decoration: none;">Admin</a> / <strong style="color: var(--rit-navy);">Company & Drive Management</strong>
      </div>

      <!-- Page Header -->
      <div style="margin-bottom: 1.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--rit-navy); margin-bottom: 0.25rem;">Placement Drive & Partner Company Administration</h1>
            <p style="color: var(--text-secondary); font-size: 0.92rem;">Authoritative drive criteria and partner company directory proxied to Team C DBMS.</p>
          </div>
        </div>
      </div>

      <!-- Placement Drives Table Card -->
      <div class="card" style="margin-bottom: 1.75rem;">
        <div class="card-header">
          <h3 class="card-title">Registered Placement Drives (${drives.length})</h3>
        </div>
        ${tableHtml}
      </div>

      <!-- Partner Companies Directory Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Partner Companies Directory (${companies.length})</h3>
        </div>
        ${companyTableHtml}
      </div>
    `;

    document.querySelectorAll('.edit-drive-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const driveId = btn.getAttribute('data-drive-id');
        const drive = drives.find(d => d.drive_id === driveId);
        if (drive) {
          window.views.admin._openEditDriveModal(drive);
        }
      });
    });

  } catch (err) {
    container.innerHTML = window.components.renderError(err, "window.views.admin.renderDrives()");
  }
};

window.views.admin._openEditDriveModal = function(drive) {
  const criteria = drive.criteria || {};

  const modalHtml = `
    <div>
      <div class="form-group">
        <label class="form-label" style="color: var(--rit-navy); font-weight: 700;">Drive Title</label>
        <input type="text" id="edit-title" class="form-control" value="${drive.title || ''}" />
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label" style="color: var(--rit-navy); font-weight: 700;">Available Seats</label>
          <input type="number" id="edit-seats" class="form-control" value="${drive.seats || 10}" min="1" />
        </div>

        <div class="form-group">
          <label class="form-label" style="color: var(--rit-navy); font-weight: 700;">Operational State</label>
          <select id="edit-state" class="form-control">
            <option value="OPEN" ${drive.state === 'OPEN' ? 'selected' : ''}>OPEN</option>
            <option value="SCREENING" ${drive.state === 'SCREENING' ? 'selected' : ''}>SCREENING</option>
            <option value="CLOSED" ${drive.state === 'CLOSED' ? 'selected' : ''}>CLOSED</option>
            <option value="DRAFT" ${drive.state === 'DRAFT' ? 'selected' : ''}>DRAFT</option>
          </select>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label" style="color: var(--rit-navy); font-weight: 700;">Minimum CGPA Cutoff</label>
          <input type="number" id="edit-min-cgpa" class="form-control" value="${criteria.min_cgpa ?? 7.0}" step="0.1" />
        </div>

        <div class="form-group">
          <label class="form-label" style="color: var(--rit-navy); font-weight: 700;">Max Backlogs Allowed</label>
          <input type="number" id="edit-max-backlogs" class="form-control" value="${criteria.max_backlogs ?? 1}" min="0" />
        </div>
      </div>
    </div>
  `;

  window.modal.open({
    title: `Edit Placement Drive Parameters: ${drive.title}`,
    contentHtml: modalHtml,
    buttons: [
      { text: 'Cancel', className: 'btn-secondary', onClick: () => true },
      {
        text: 'Save Changes',
        className: 'btn-primary',
        onClick: async (e, modalRoot) => {
          try {
            const title = modalRoot.querySelector('#edit-title').value;
            const seats = parseInt(modalRoot.querySelector('#edit-seats').value, 10);
            const state = modalRoot.querySelector('#edit-state').value;
            const minCgpa = parseFloat(modalRoot.querySelector('#edit-min-cgpa').value);
            const maxBacklogs = parseInt(modalRoot.querySelector('#edit-max-backlogs').value, 10);

            const updatedCriteria = {
              ...criteria,
              min_cgpa: minCgpa,
              max_backlogs: maxBacklogs
            };

            await window.api.updateDrive(drive.drive_id, {
              title,
              seats,
              state,
              criteria: updatedCriteria
            });

            window.toast.success('Drive parameters updated in Team C DBMS!');
            window.views.admin.renderDrives();
            return true;
          } catch (err) {
            window.toast.error(err.message || 'Failed to update drive');
            return false;
          }
        }
      }
    ]
  });
};
