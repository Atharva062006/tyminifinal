/**
 * Student Placement Offers & Compensation Dashboard View for Team D Frontend.
 * Clean RIT Institutional Design Theme.
 */

window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderOffers = async function() {
  const container = document.getElementById('main-content');
  container.innerHTML = window.components.renderLoading('Fetching placement offers from Team C DBMS...');

  try {
    const user = window.store.get('user') || {};
    const apps = await window.api.getApplications({ student_id: user.id });

    // Filter offer records
    const offerApps = apps.filter(a => ['OFFER_ISSUED', 'OFFER_ACCEPTED', 'OFFER_DECLINED'].includes(a.state));
    const activeOffer = apps.find(a => a.state === 'OFFER_ISSUED');

    const offerRecords = offerApps.map(a => ({
      application_id: a.application_id,
      company: a.company_name || 'Company',
      role: a.drive_title || 'Role',
      package: a.package ? `₹${(a.package / 100000).toFixed(1)} LPA` : '₹8.5 LPA',
      packageVal: a.package || 850000,
      issueDate: a.created_at ? new Date(a.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
      state: a.state
    }));

    container.innerHTML = `
      <!-- Breadcrumb -->
      <div id="breadcrumb-bar" style="margin-bottom: 1.25rem;">
        <span style="color: var(--text-muted);">Home</span> / <strong style="color: var(--rit-navy);">Offers</strong>
      </div>

      <!-- Page Header -->
      <div style="margin-bottom: 2rem;">
        <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--rit-navy); margin-bottom: 0.25rem;">Placement Offers & Compensation Dashboard</h1>
        <p style="color: var(--text-secondary); font-size: 0.92rem;">Manage formal placement offers and accept/decline institutional offers.</p>
      </div>

      <!-- Featured Active Offer Action Card -->
      ${activeOffer ? `
        <div class="card" style="border: 2px solid #bbf7d0; background: #f0fdf4; margin-bottom: 1.75rem; box-shadow: var(--shadow-md);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
            <div>
              <div style="font-size: 0.75rem; color: #15803d; font-weight: 800; text-transform: uppercase;">ACTION REQUIRED — ACTIVE PLACEMENT OFFER</div>
              <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--rit-navy); margin-top: 0.2rem;">
                Formal Placement Offer: ${activeOffer.drive_title}
              </h2>
              <div style="font-size: 0.92rem; color: var(--text-secondary); margin-top: 0.25rem;">
                Company: <strong style="color: var(--rit-navy);">${activeOffer.company_name}</strong> • Offered Package: <strong style="color: #15803d; font-size: 1.05rem;">₹${activeOffer.package ? (activeOffer.package / 100000).toFixed(1) : '8.5'} LPA</strong>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.35rem;">
                Issued On: ${activeOffer.created_at ? new Date(activeOffer.created_at).toLocaleDateString() : 'Today'} • Offer State: <span class="badge badge-offer_issued">OFFER_ISSUED</span>
              </div>
            </div>

            <div style="display: flex; gap: 0.85rem; flex-wrap: wrap;">
              <button id="decline-offer-btn-${activeOffer.application_id}" class="btn btn-secondary">
                Decline Offer
              </button>
              <button id="accept-offer-btn-${activeOffer.application_id}" class="btn btn-primary" style="background: #15803d; border-color: #15803d;">
                Accept Offer
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- All Offers Data Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Placement Offers History (${offerRecords.length})</h3>
        </div>

        ${window.components.renderDataTable({
          columns: [
            {
              label: 'Company',
              render: row => `<strong style="color: var(--rit-navy);">${row.company}</strong>`
            },
            {
              label: 'Role',
              render: row => `<strong>${row.role}</strong><br><span style="font-size: 0.72rem; color: var(--text-muted); font-family: 'JetBrains Mono';">${row.application_id}</span>`
            },
            {
              label: 'Offered CTC',
              render: row => `<strong style="color: #15803d; font-family: 'JetBrains Mono'; font-size: 1rem;">${row.package}</strong>`
            },
            {
              label: 'Offer Date',
              render: row => row.issueDate
            },
            {
              label: 'Offer Status',
              render: row => window.components.renderBadge(row.state)
            },
            {
              label: 'Action',
              render: row => row.state === 'OFFER_ISSUED' ? `
                <a href="#/student/applications/${row.application_id}" class="btn btn-primary btn-sm">
                  Review & Respond →
                </a>
              ` : `
                <a href="#/student/applications/${row.application_id}" class="btn btn-secondary btn-sm">
                  View App →
                </a>
              `
            }
          ],
          rows: offerRecords,
          emptyMessage: 'No placement offers received yet.'
        })}
      </div>
    `;

    // Bind Accept/Decline action buttons with modal confirmation
    if (activeOffer) {
      const appId = activeOffer.application_id;
      const packageLpa = activeOffer.package ? (activeOffer.package / 100000).toFixed(1) : '8.5';

      document.getElementById(`accept-offer-btn-${appId}`)?.addEventListener('click', () => {
        window.modal.confirm({
          title: 'Confirm Offer Acceptance',
          message: `Are you sure you want to accept this placement offer for '${activeOffer.drive_title}' at ₹${packageLpa} LPA from '${activeOffer.company_name}'? Accepting this offer will register your official placement in Team C DBMS.`,
          confirmText: 'Accept Offer',
          confirmClass: 'btn-primary',
          onConfirm: async () => {
            try {
              await window.api.submitOfferDecision(appId, 'ACCEPT');
              window.toast.success('Placement offer ACCEPTED! Institutional placement record updated.');
              await window.views.student.renderOffers();
            } catch (err) {
              window.toast.error(err.message || 'Failed to accept offer');
            }
          }
        });
      });

      document.getElementById(`decline-offer-btn-${appId}`)?.addEventListener('click', () => {
        window.modal.confirm({
          title: 'Confirm Offer Decline',
          message: `Are you sure you want to decline this placement offer for '${activeOffer.drive_title}' from '${activeOffer.company_name}'?`,
          confirmText: 'Decline Offer',
          confirmClass: 'btn-danger',
          onConfirm: async () => {
            try {
              await window.api.submitOfferDecision(appId, 'DECLINE');
              window.toast.info('Offer DECLINED.');
              await window.views.student.renderOffers();
            } catch (err) {
              window.toast.error(err.message || 'Failed to decline offer');
            }
          }
        });
      });
    }

  } catch (err) {
    container.innerHTML = window.components.renderError(err, "window.views.student.renderOffers()");
  }
};
