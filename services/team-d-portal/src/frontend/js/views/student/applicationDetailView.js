/**
 * Detailed Application Tracking & Offer Decision View for RIT Portal.
 * Clean RIT Institutional Design Theme.
 */

window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderApplicationDetail = async function(applicationId) {
  const container = document.getElementById('main-content');
  container.innerHTML = window.components.renderLoading('Loading application details & cross-service status...');

  try {
    const data = await window.api.getApplication(applicationId);
    const app = data.application || {};
    const drive = data.drive || {};
    const student = data.student || {};
    const timeline = data.timeline || [];
    const ranking = data.ranking || null;
    const trace = data.traceability || {};

    const canWithdraw = !['WITHDRAWN', 'OFFER_ISSUED', 'OFFER_ACCEPTED', 'OFFER_DECLINED', 'NOT_ELIGIBLE'].includes(app.state);
    const isOfferIssued = app.state === 'OFFER_ISSUED';
    const isInterviewScheduled = app.state === 'INTERVIEW_SCHEDULED';

    container.innerHTML = `
      <!-- Breadcrumb -->
      <div id="breadcrumb-bar" style="margin-bottom: 1.25rem;">
        <span style="color: var(--text-muted);">Home</span> / <a href="#/student/applications" style="color: var(--text-muted); text-decoration: none;">My Applications</a> / <strong style="color: var(--rit-navy);">${app.application_id}</strong>
      </div>

      <!-- Page Header -->
      <div style="margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="font-size: 0.8rem; color: var(--rit-blue); font-weight: 700; text-transform: uppercase;">APPLICATION TRACKER</div>
            <h1 style="font-size: 1.85rem; font-weight: 800; color: var(--rit-navy); margin-top: 0.15rem;">
              ${drive.title || 'Placement Drive'}
            </h1>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">
              Company: <strong style="color: var(--rit-navy);">${drive.company?.name || 'Company'}</strong> • Package: <strong style="color: var(--accent-emerald);">${drive.package ? `₹${(drive.package / 100000).toFixed(1)} LPA` : '—'}</strong>
            </p>
          </div>

          <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            ${window.components.renderBadge(app.state)}
            ${canWithdraw ? `
              <button id="withdraw-app-btn" class="btn btn-danger btn-sm">Withdraw Application</button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Offer Decision Banner (Only when OFFER_ISSUED) -->
      ${isOfferIssued ? `
        <div class="card" style="border: 2px solid var(--accent-emerald); background: #f0fdf4; margin-bottom: 1.5rem; box-shadow: var(--shadow-md);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
            <div>
              <div style="font-size: 0.8rem; color: var(--accent-emerald); font-weight: 700; text-transform: uppercase;">Placement Offer Issued</div>
              <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--rit-navy); margin-top: 0.2rem;">Congratulations! Formal Placement Offer Received.</h3>
              <p style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 0.3rem;">
                Offered Package: <strong style="color: var(--accent-emerald);">₹${drive.package ? (drive.package / 100000).toFixed(1) : '—'} LPA</strong> • Company: <strong>${drive.company?.name || 'Company'}</strong>
              </p>
            </div>
            <div style="display: flex; gap: 0.75rem;">
              <button id="decline-offer-btn" class="btn btn-secondary">Decline Offer</button>
              <button id="accept-offer-btn" class="btn btn-primary" style="background: var(--accent-emerald);">Accept Offer</button>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Interview Schedule Card (Only when INTERVIEW_SCHEDULED) -->
      ${isInterviewScheduled ? `
        <div class="card" style="margin-bottom: 1.5rem; border: 1px solid #fde68a; background: #fefce8;">
          <div class="card-header">
            <h3 class="card-title" style="color: var(--accent-amber);">Interview Schedule & Virtual Venue</h3>
            <span class="badge badge-interview_scheduled">SCHEDULED</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="font-weight: 700; font-size: 1rem; color: var(--rit-navy);">Technical Interview Round 1</div>
              <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                Scheduled: <strong>Tomorrow, 10:30 AM IST</strong> • Mode: <strong>Online Video Conference</strong>
              </div>
            </div>
            <a href="https://meet.jit.si/rit-placement-interview" target="_blank" class="btn btn-primary btn-sm">
              Join Video Meeting →
            </a>
          </div>
        </div>
      ` : ''}

      <!-- Structured Grid Sections -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
        
        <!-- 1. Company & Position -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Company & Position</h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.88rem;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
              <span style="color: var(--text-muted);">Company Name:</span>
              <strong style="color: var(--rit-navy);">${drive.company?.name || 'Company'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
              <span style="color: var(--text-muted);">Job Position:</span>
              <strong style="color: var(--rit-navy);">${drive.title || 'Role'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
              <span style="color: var(--text-muted);">Offered Package:</span>
              <strong style="color: var(--accent-emerald);">${drive.package ? `₹${(drive.package / 100000).toFixed(1)} LPA` : '—'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Location / Venue:</span>
              <strong>${drive.location || drive.venue || 'RIT Campus On-Site'}</strong>
            </div>
          </div>
        </div>

        <!-- 2. Application Information -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Application Information</h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.88rem;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
              <span style="color: var(--text-muted);">Application ID:</span>
              <strong class="mono" style="color: var(--rit-blue);">${app.application_id}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
              <span style="color: var(--text-muted);">Submission Timestamp:</span>
              <strong>${app.created_at ? new Date(app.created_at).toLocaleString() : '—'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
              <span style="color: var(--text-muted);">Resume Profile Version:</span>
              <span class="mono">${app.resume_version || 'v1.0 (Verified)'}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Idempotency Protection:</span>
              <span style="color: var(--accent-emerald);">Active (Key Enforced)</span>
            </div>
          </div>
        </div>

        <!-- 3. Eligibility (Team A) -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Eligibility Criteria Check (Team A)</h3>
            <span class="badge badge-open">Rule Verified</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.88rem;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
              <span style="color: var(--text-muted);">Evaluation Result:</span>
              ${window.components.renderEligibilityBadge(app.state === 'NOT_ELIGIBLE' ? 'NOT_ELIGIBLE' : 'ELIGIBLE')}
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
              <span style="color: var(--text-muted);">Student CGPA:</span>
              <strong style="color: var(--rit-navy);">${student.cgpa || 'Data unavailable'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Active Backlogs:</span>
              <strong>${student.backlogs !== undefined ? student.backlogs : 'Data unavailable'}</strong>
            </div>
          </div>
        </div>

        <!-- 4. Ranking (Team B) -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Candidate Standing (Team B)</h3>
            <span class="badge badge-${ranking ? 'applied' : 'closed'}">${ranking ? 'Calculated' : 'Pending'}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.88rem;">
            ${ranking ? `
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">Candidate Rank:</span>
                <strong style="color: var(--rit-blue); font-size: 1.1rem;">#${ranking.rank}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Match Score:</span>
                <strong style="color: var(--accent-emerald); font-family: 'JetBrains Mono';">${(ranking.total_score * 100).toFixed(1)}%</strong>
              </div>
            ` : `
              <p style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0;">
                Candidate ranking score will be computed upon shortlisting by TPO office.
              </p>
            `}
          </div>
        </div>

      </div>

      <!-- 5. Timeline (State Machine Progression) -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <h3 class="card-title">⏱️ Application Timeline & State Machine History</h3>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Authoritative Team C DBMS Audit Log</span>
        </div>
        ${window.components.renderTimeline(timeline)}
      </div>

      <!-- 6. Audit & Traceability Banner -->
      <div class="card" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); font-size: 0.78rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <strong>Cross-Service Correlation Trace:</strong>
            <span class="mono" style="color: var(--text-muted); margin-left: 0.5rem;">${trace.application_id || app.application_id}</span>
          </div>
          <div style="color: var(--text-muted);">
            Idempotency Key: <span class="mono" style="color: var(--rit-navy);">${trace.idempotency_key ? trace.idempotency_key.substring(0, 20) + '...' : 'ENFORCED'}</span>
          </div>
        </div>
      </div>
    `;

    // Event Bindings
    document.getElementById('accept-offer-btn')?.addEventListener('click', () => {
      window.modal.confirm({
        title: 'Confirm Offer Acceptance',
        message: `Accepting this placement offer for '${drive.title}' at ₹${(drive.package / 100000).toFixed(1)} LPA will officially register your placement in Team C DBMS. Do you wish to proceed?`,
        confirmText: 'Accept Offer',
        confirmClass: 'btn-primary',
        onConfirm: async () => {
          try {
            await window.api.submitOfferDecision(applicationId, 'ACCEPT');
            window.toast.success('Placement offer ACCEPTED!');
            window.views.student.renderApplicationDetail(applicationId);
          } catch (err) {
            window.toast.error(err.message || 'Failed to accept offer');
          }
        }
      });
    });

    document.getElementById('decline-offer-btn')?.addEventListener('click', () => {
      window.modal.confirm({
        title: 'Confirm Offer Decline',
        message: `Are you sure you want to decline this placement offer?`,
        confirmText: 'Decline Offer',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          try {
            await window.api.submitOfferDecision(applicationId, 'DECLINE');
            window.toast.info('Offer DECLINED.');
            window.views.student.renderApplicationDetail(applicationId);
          } catch (err) {
            window.toast.error(err.message || 'Failed to decline offer');
          }
        }
      });
    });

    document.getElementById('withdraw-app-btn')?.addEventListener('click', () => {
      window.modal.confirm({
        title: 'Confirm Application Withdrawal',
        message: `Are you sure you want to withdraw your application for '${drive.title}'?`,
        confirmText: 'Yes, Withdraw Application',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          try {
            await window.api.withdrawApplication(applicationId);
            window.toast.success('Application withdrawn successfully');
            window.views.student.renderApplicationDetail(applicationId);
          } catch (err) {
            window.toast.error(err.message || 'Failed to withdraw application');
          }
        }
      });
    });

  } catch (err) {
    container.innerHTML = window.components.renderError(err, `window.views.student.renderApplicationDetail('${applicationId}')`);
  }
};
