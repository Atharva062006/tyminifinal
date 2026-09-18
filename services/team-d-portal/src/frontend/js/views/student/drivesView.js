/**
 * Drive Discovery View for Student Portal.
 * Clean RIT Institutional Design Theme.
 */

window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderDrives = async function() {
  const container = document.getElementById('main-content');
  
  // Loading Skeleton State
  container.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Loading placement drives and student eligibility status...</p>
    </div>
  `;

  try {
    const user = window.store.get('user') || {};
    const [drives, studentApps] = await Promise.all([
      window.api.getDrives(),
      window.api.getApplications({ student_id: user.id }).catch(() => [])
    ]);
    
    container.innerHTML = `
      <!-- Breadcrumb -->
      <div id="breadcrumb-bar" style="margin-bottom: 1.25rem;">
        <span style="color: var(--text-muted);">Home</span> / <strong style="color: var(--rit-navy);">Placements</strong>
      </div>

      <!-- Page Header -->
      <div style="margin-bottom: 2rem;">
        <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--rit-navy); margin-bottom: 0.25rem;">Placement Drives</h1>
        <p style="color: var(--text-secondary); font-size: 0.92rem;">Explore current and upcoming placement opportunities.</p>
      </div>

      <!-- Supported Filter Bar -->
      <div class="filter-bar" style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; background: #ffffff; padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); box-shadow: var(--shadow-sm);">
        <div style="flex: 2; min-width: 220px;">
          <input type="text" id="drive-search" class="form-control" placeholder="Search company name, role, or keywords..." />
        </div>
        <div style="flex: 1; min-width: 140px;">
          <select id="branch-filter" class="form-control">
            <option value="">All Branches</option>
            <option value="CSE">CSE</option>
            <option value="IT">IT</option>
            <option value="ENTC">ENTC</option>
            <option value="MECH">MECH</option>
            <option value="CIVIL">CIVIL</option>
          </select>
        </div>
        <div style="flex: 1; min-width: 140px;">
          <select id="status-filter" class="form-control">
            <option value="" selected>All Drive Statuses</option>
            <option value="OPEN">OPEN Only</option>
            <option value="CLOSED">CLOSED Only</option>
          </select>
        </div>
        <div style="flex: 1; min-width: 140px;">
          <select id="sort-filter" class="form-control">
            <option value="latest">Sort: Latest First</option>
            <option value="package">Sort: Highest Package</option>
          </select>
        </div>
      </div>

      <!-- Drives Grid -->
      <div id="drives-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
        ${window.views.student._renderDriveCards(drives, studentApps, user)}
      </div>
    `;

    // Filter event listeners
    const searchInput = document.getElementById('drive-search');
    const branchFilter = document.getElementById('branch-filter');
    const statusFilter = document.getElementById('status-filter');
    const sortFilter = document.getElementById('sort-filter');

    const applyFilters = () => {
      const q = searchInput.value.toLowerCase().trim();
      const branch = branchFilter.value;
      const status = statusFilter.value;
      const sortBy = sortFilter.value;

      let filtered = drives.filter(d => {
        const matchesQuery = !q || (d.title && d.title.toLowerCase().includes(q)) || (d.company?.name && d.company.name.toLowerCase().includes(q));
        const matchesStatus = !status || (d.state && d.state.toUpperCase() === status.toUpperCase());
        
        let matchesBranch = true;
        if (branch) {
          const allowed = d.criteria?.branches || d.criteria?.allowed_branches || [];
          matchesBranch = allowed.length === 0 || allowed.some(b => b.toUpperCase() === branch.toUpperCase() || b.toUpperCase() === 'ALL BRANCHES');
        }

        return matchesQuery && matchesStatus && matchesBranch;
      });

      if (sortBy === 'package') {
        filtered.sort((a, b) => (b.package || 0) - (a.package || 0));
      } else {
        filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      }

      document.getElementById('drives-grid').innerHTML = window.views.student._renderDriveCards(filtered, studentApps, user);
    };

    searchInput.addEventListener('input', applyFilters);
    branchFilter.addEventListener('change', applyFilters);
    statusFilter.addEventListener('change', applyFilters);
    sortFilter.addEventListener('change', applyFilters);

  } catch (err) {
    container.innerHTML = window.components.renderError(err, "window.views.student.renderDrives()");
  }
};

window.views.student._renderDriveCards = function(drives, studentApps = [], user = {}) {
  if (!drives || drives.length === 0) {
    return `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted); background: #ffffff; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--rit-navy);">No placement drives match your criteria.</h3>
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 0.25rem;">Try adjusting your search terms or filter selections.</p>
      </div>
    `;
  }

  return drives.map(drive => {
    const company = drive.company || {};
    const criteria = drive.criteria || {};
    const pkg = drive.package ? `₹${(drive.package / 100000).toFixed(1)} LPA` : '—';
    const branches = criteria.branches || criteria.allowed_branches || ['All Branches'];
    const minCgpa = criteria.min_cgpa !== undefined ? criteria.min_cgpa : '—';
    const maxBacklogs = criteria.max_backlogs !== undefined ? criteria.max_backlogs : '—';

    // Application & Deadline status evaluation
    const myApp = studentApps.find(a => a.drive_id === drive.drive_id);
    const isApplied = !!myApp;
    const isClosed = drive.state === 'CLOSED';
    const isDeadlinePassed = drive.deadline ? (new Date() > new Date(drive.deadline)) : false;

    // Student Eligibility Evaluation
    const studentCgpa = user.cgpa !== undefined ? user.cgpa : 8.0;
    const studentBacklogs = user.backlogs !== undefined ? user.backlogs : 0;
    const studentBranch = user.branch || 'CSE';
    
    const isEligible = (minCgpa === '—' || studentCgpa >= minCgpa) &&
                       (maxBacklogs === '—' || studentBacklogs <= maxBacklogs) &&
                       (branches.includes('All Branches') || branches.includes(studentBranch));

    let statusBadgeHtml = '';
    if (isApplied) {
      statusBadgeHtml = `<span class="badge badge-applied">Applied</span>`;
    } else if (isClosed) {
      statusBadgeHtml = `<span class="badge badge-closed">Closed</span>`;
    } else if (isDeadlinePassed) {
      statusBadgeHtml = `<span class="badge badge-closed">Deadline Passed</span>`;
    } else {
      statusBadgeHtml = `<span class="badge badge-open">OPEN</span>`;
    }

    const eligibilityBadgeHtml = isEligible
      ? `<span class="badge badge-open" style="background: #dcfce7; color: #15803d; border-color: #bbf7d0;">Eligible</span>`
      : `<span class="badge badge-not_eligible">Not Eligible</span>`;

    return `
      <div class="card" style="display: flex; flex-direction: column; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <div style="width: 40px; height: 40px; border-radius: var(--radius-md); background: var(--bg-tertiary); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; font-weight: 800; color: var(--rit-navy);">
              ${(company.name || 'C').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-size: 0.78rem; color: var(--rit-blue); font-weight: 700; text-transform: uppercase;">${company.name || 'Company'}</div>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--rit-navy); margin-top: 0.1rem;">${drive.title}</h3>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.3rem;">
            ${statusBadgeHtml}
            ${eligibilityBadgeHtml}
          </div>
        </div>

        <div style="display: flex; gap: 1rem; background: var(--bg-tertiary); padding: 0.75rem 1rem; border-radius: var(--radius-md); margin: 0.75rem 0; border: 1px solid var(--border-color); font-size: 0.85rem;">
          <div>
            <span style="font-size: 0.7rem; color: var(--text-muted); display: block; font-weight: 700;">CTC PACKAGE</span>
            <strong style="color: var(--accent-emerald); font-size: 0.95rem;">${pkg}</strong>
          </div>
          <div style="border-left: 1px solid var(--border-color); padding-left: 1rem;">
            <span style="font-size: 0.7rem; color: var(--text-muted); display: block; font-weight: 700;">DRIVE DATE</span>
            <strong style="color: var(--text-primary); font-size: 0.85rem;">${drive.drive_date || (drive.deadline ? new Date(drive.deadline).toLocaleDateString() : 'Active')}</strong>
          </div>
        </div>

        <!-- Eligible Branches & Criteria Tags -->
        <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.25rem; font-size: 0.75rem;">
          <span style="background: var(--bg-tertiary); padding: 0.25rem 0.55rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">CGPA: ≥${minCgpa}</span>
          <span style="background: var(--bg-tertiary); padding: 0.25rem 0.55rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">Max Backlogs: ${maxBacklogs}</span>
          <span style="background: var(--bg-tertiary); padding: 0.25rem 0.55rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">${branches.slice(0, 3).join(', ')}${branches.length > 3 ? '...' : ''}</span>
        </div>

        <!-- Actions -->
        <div style="display: flex; gap: 0.5rem; margin-top: auto; flex-wrap: wrap;">
          <a href="#/student/drives/${drive.drive_id}" class="btn btn-secondary btn-sm" style="flex: 1;">View Details</a>
          <a href="#/student/eligibility?drive_id=${drive.drive_id}" class="btn btn-secondary btn-sm" style="flex: 1;">Check Eligibility</a>
          ${(!isApplied && !isClosed && !isDeadlinePassed && isEligible) ? `
            <a href="#/student/drives/${drive.drive_id}" class="btn btn-primary btn-sm" style="flex: 1;">Apply</a>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
};
