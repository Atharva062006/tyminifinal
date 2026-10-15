/**
 * Drive detail + application flow: criteria, live eligibility breakdown (Team A), queue status, apply modal.
 */
window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderDriveDetail = async function (driveId) {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const user = window.store.get('user');

  const [drive, myApps, check] = await Promise.all([
    window.api.getDrive(driveId),
    window.api.getApplications().catch(() => []),
    window.api.checkEligibility(driveId).catch(e => ({ error: e })),
  ]);

  const company = drive.company || {};
  const crit = drive.criteria || {};
  const mine = myApps.filter(a => a.drive_id === driveId && !['WITHDRAWN', 'REJECTED', 'NOT_ELIGIBLE', 'OFFER_DECLINED'].includes(a.state))[0];
  const ev = check.evaluation;
  const deadlinePassed = drive.deadline && new Date(drive.deadline) < new Date();
  const q = drive.queue_status || {};
  const seatsTotal = drive.seats_total || drive.seats || 1;

  let cta;
  if (mine) cta = `<a class="btn btn-secondary" href="#/student/applications/${esc(mine.application_id)}">Already applied — ${esc(mine.state.replace(/_/g, ' '))} · Track</a>`;
  else if (drive.state !== 'OPEN') cta = `<button class="btn btn-secondary" disabled>Drive ${esc(drive.state.toLowerCase())}</button>`;
  else if (deadlinePassed) cta = '<button class="btn btn-secondary" disabled>Deadline passed</button>';
  else if (drive.seats <= 0) cta = '<button class="btn btn-secondary" disabled>No seats left</button>';
  else if (ev && ev.eligibility_result === 'NOT_ELIGIBLE') cta = '<button class="btn btn-secondary" disabled title="You do not meet the hard criteria">Not eligible</button>';
  else cta = `<button class="btn btn-primary btn-lg" id="apply-btn">${ev && ev.eligibility_result === 'CONDITIONAL' ? 'Apply (conditional)' : 'Apply now'}</button>`;

  c.innerHTML = `
    ${window.components.pageHeader({
      title: drive.title,
      subtitle: `${company.name || ''}${company.industry ? ' · ' + company.industry : ''}`,
      crumbs: [{ label: 'Drives', href: '#/student/drives' }, { label: drive.title }],
      tags: [['C', 'drive & seats'], ['A', 'eligibility & queue']],
      actions: cta,
    })}
    <div class="grid split">
      <div class="stack">
        <div class="card">
          <div class="card-head"><h3>About the role</h3><span class="badge badge-${esc(String(drive.state).toLowerCase())}">${esc(drive.state)}</span></div>
          <p class="sub">${esc(drive.description || company.description || 'Details will be shared by the placement cell.')}</p>
          <dl class="kv" style="margin-top:1rem;">
            <dt>Package</dt><dd><b>${esc(fmt.money(drive.package))}</b></dd>
            <dt>Location</dt><dd>${esc(drive.location || '—')}</dd>
            <dt>Application deadline</dt><dd>${esc(fmt.date(drive.deadline))}</dd>
            <dt>Seats</dt><dd>${esc(drive.seats)} remaining of ${esc(seatsTotal)}<div class="seat-bar" style="margin-top:.35rem;max-width:260px;"><div style="width:${Math.round(((seatsTotal - drive.seats) / seatsTotal) * 100)}%"></div></div></dd>
            <dt>Company site</dt><dd>${company.website ? `<a class="link" href="${esc(company.website)}" target="_blank" rel="noopener">${esc(company.website)}</a>` : '—'}</dd>
          </dl>
        </div>

        <div class="card">
          <div class="card-head"><h3>Your eligibility</h3>${window.components.teamTag('A', 'rule-chaining engine')}</div>
          ${ev ? window.components.eligibilityBreakdown(ev) : `<div class="alert warn">${esc(window.components.errorText(check.error))}</div>`}
          ${ev && ev.eligibility_result === 'CONDITIONAL' ? '<div class="alert info" style="margin-top:1rem;">You meet the hard criteria but fall short on skills. You can still apply; the placement cell reviews conditional candidates manually.</div>' : ''}
          <p style="margin-top:1rem;"><a class="link" href="#/student/eligibility">Compare rule strategies →</a></p>
        </div>
      </div>

      <div class="stack">
        <div class="card"><div class="card-head"><h3>Requirements</h3></div>
          <ul class="todo-list" style="gap:.4rem;">
            <li>Minimum CGPA <b>${esc(crit.min_cgpa ?? 'n/a')}</b></li>
            <li>Active backlogs at most <b>${esc(crit.max_backlogs ?? 'n/a')}</b></li>
            <li>Attendance at least <b>${esc(crit.min_attendance ?? 'n/a')}%</b></li>
            <li>Branches: <b>${esc((crit.branches || []).join(', ') || 'All')}</b></li>
          </ul>
          <div class="facts" style="margin-top:.8rem;">${(crit.required_skills || []).map(s => `<span class="chip">${esc(s)}</span>`).join('') || '<span class="muted small">No specific skills required</span>'}</div>
        </div>
        <div class="card"><div class="card-head"><h3>Evaluation queue</h3>${window.components.teamTag('A', 'queue scheduler')}</div>
          <dl class="kv">
            <dt>Policy</dt><dd>${esc(q.queue_policy || '—')}</dd>
            <dt>Requests waiting</dt><dd>${esc(q.queue_depth ?? 0)}</dd>
            <dt>Est. turnaround</dt><dd>${esc(q.estimated_turnaround_time_ms ?? 0)} ms</dd>
            <dt>Evaluated so far</dt><dd>${esc(q.evaluated_total ?? '—')}</dd>
          </dl>
        </div>
      </div>
    </div>`;

  document.getElementById('apply-btn')?.addEventListener('click', () => {
    const conditional = ev && ev.eligibility_result === 'CONDITIONAL';
    window.components.formModal({
      title: `Apply to ${drive.title}`,
      intro: `${company.name || ''} · ${fmt.money(drive.package)}. Your eligibility will be re-checked by the rule engine and you will be ranked automatically.`,
      submitText: 'Submit application',
      fields: [
        { name: 'resume_version', label: 'Resume version', type: 'select', options: [{ value: 'v1.0', label: 'v1.0 — current profile resume' }, { value: 'v2.0', label: 'v2.0 — updated resume' }], value: 'v1.0', full: true, help: user.resume_url ? '' : 'Tip: add your resume link to your profile so recruiters can open it.' },
        ...(conditional ? [{ name: 'ack', label: 'I understand I only partly meet the skill requirements and will be reviewed manually.', type: 'checkbox', value: false, full: true }] : []),
        { name: 'consent', label: 'I consent to share my academic record and profile with the placement cell and the hiring company for this drive.', type: 'checkbox', value: false, full: true },
      ],
      onSubmit: async (v) => {
        if (!v.consent) throw new Error('Consent is required to submit an application.');
        if (conditional && !v.ack) throw new Error('Please acknowledge the conditional eligibility.');
        const app = await window.api.createApplication({ student_id: user.id, drive_id: driveId, resume_version: v.resume_version, consent: true });
        const msg = app.state === 'NOT_ELIGIBLE' ? 'Application recorded, but the rule engine found you not eligible.'
          : app.state === 'RULE_EVALUATED' ? `Application submitted — eligibility confirmed${app.rank ? `, ranked #${app.rank} of ${app.rank_pool}` : ''}.`
          : 'Application submitted. Evaluation is in progress.';
        window.toast[app.state === 'NOT_ELIGIBLE' ? 'warning' : 'success'](msg);
        window.location.hash = `#/student/applications/${app.application_id}`;
      },
    });
  });
};
