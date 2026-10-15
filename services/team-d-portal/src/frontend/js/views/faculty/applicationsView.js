/**
 * Staff application review: filter the applicant registry and move candidates through the pipeline
 * (shortlist / waitlist / reject / schedule interview / select / issue offer). Every button calls Team C,
 * which enforces the state machine, seats and Team A interview-slot leases.
 */
window.views = window.views || {};
window.views.faculty = window.views.faculty || {};

const TABS = [
  { id: 'REVIEW', label: 'Needs review', states: ['RULE_EVALUATED', 'WAITLISTED'] },
  { id: 'SHORTLISTED', label: 'Shortlisted', states: ['SHORTLISTED'] },
  { id: 'INTERVIEW', label: 'Interviews', states: ['INTERVIEW_SCHEDULED'] },
  { id: 'OFFERS', label: 'Selected & offers', states: ['SELECTED', 'OFFER_ISSUED', 'OFFER_ACCEPTED'] },
  { id: 'CLOSED', label: 'Closed', states: ['NOT_ELIGIBLE', 'REJECTED', 'WITHDRAWN', 'OFFER_DECLINED', 'EXPIRED'] },
  { id: 'PENDING', label: 'Pipeline pending', states: ['APPLIED', 'SCREENING'] },
  { id: 'ALL', label: 'All', states: null },
];

function actionButtons(a) {
  const b = (act, label, cls = 'btn-secondary') => `<button class="btn ${cls} btn-sm" data-act="${act}" data-id="${esc(a.application_id)}">${label}</button>`;
  switch (a.state) {
    case 'RULE_EVALUATED': return b('shortlist', 'Shortlist', 'btn-success') + b('waitlist', 'Waitlist', 'btn-warn') + b('reject', 'Reject', 'btn-outline-danger');
    case 'WAITLISTED': return b('shortlist', 'Shortlist', 'btn-success') + b('reject', 'Reject', 'btn-outline-danger');
    case 'SHORTLISTED': return b('interview', 'Schedule interview', 'btn-primary') + b('waitlist', 'Waitlist', 'btn-warn') + b('reject', 'Reject', 'btn-outline-danger');
    case 'INTERVIEW_SCHEDULED': return b('select', 'Mark selected', 'btn-success') + b('interview', 'Add round', 'btn-secondary') + b('reject', 'Reject', 'btn-outline-danger');
    case 'SELECTED': return b('offer', 'Issue offer', 'btn-primary') + b('reject', 'Release', 'btn-outline-danger');
    case 'SCREENING': case 'APPLIED': return b('reeval', 'Re-evaluate', 'btn-secondary');
    default: return '';
  }
}

window.views.faculty.renderApplications = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const role = window.store.get('user').role;
  const base = role === 'admin' ? '#/admin' : '#/faculty';
  const [apps, drives] = await Promise.all([window.api.getApplications(), window.api.getDrives()]);
  const f = window.__facApp = window.__facApp || { tab: 'REVIEW', q: '', drive: '', elig: '' };
  const counts = Object.fromEntries(TABS.map(t => [t.id, t.states ? apps.filter(a => t.states.includes(a.state)).length : apps.length]));
  if (!window.__facAppInit) { window.__facAppInit = true; if (!counts.REVIEW && counts.SHORTLISTED) f.tab = 'SHORTLISTED'; }

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Review applications', subtitle: 'Shortlist, schedule interviews, select and issue offers. Applicants are ordered by Team B rank within each drive.',
      tags: [['C', 'state machine & audit'], ['A', 'interview slot leases'], ['B', 'rank & score']],
      actions: `<button class="btn btn-secondary btn-sm" id="bulk-shortlist" disabled>Shortlist selected</button>`,
    })}
    <div class="tabs" role="tablist">${TABS.map(t => `<button class="tab ${t.id === f.tab ? 'active' : ''}" role="tab" data-tab="${t.id}">${t.label} <span class="chip gray" style="padding:0 .4rem;">${counts[t.id]}</span></button>`).join('')}</div>
    <div class="filter-bar">
      <input id="fa-q" class="form-control" style="flex:2;min-width:180px;" type="search" placeholder="Search student name, ID or drive…" value="${esc(f.q)}" aria-label="Search"/>
      <select id="fa-drive" class="form-control" aria-label="Drive"><option value="">All drives</option>${drives.map(d => `<option value="${esc(d.drive_id)}" ${f.drive === d.drive_id ? 'selected' : ''}>${esc(d.title)}</option>`).join('')}</select>
      <select id="fa-elig" class="form-control" aria-label="Eligibility"><option value="">Any eligibility</option><option value="ELIGIBLE" ${f.elig === 'ELIGIBLE' ? 'selected' : ''}>Eligible</option><option value="CONDITIONAL" ${f.elig === 'CONDITIONAL' ? 'selected' : ''}>Conditional</option><option value="NOT_ELIGIBLE" ${f.elig === 'NOT_ELIGIBLE' ? 'selected' : ''}>Not eligible</option></select>
    </div>
    <div class="card" style="padding:.5rem;"><div id="fa-table"></div></div>`;

  const draw = () => {
    const tab = TABS.find(t => t.id === f.tab);
    const q = f.q.toLowerCase();
    const rows = apps.filter(a =>
      (!tab.states || tab.states.includes(a.state)) &&
      (!f.drive || a.drive_id === f.drive) &&
      (!f.elig || a.eligibility_result === f.elig) &&
      (!q || `${a.student_id} ${a.student_name || ''} ${a.drive_title || ''} ${a.company_name || ''}`.toLowerCase().includes(q)))
      .sort((x, y) => (x.drive_id === y.drive_id ? ((x.rank || 999) - (y.rank || 999)) : String(x.drive_title).localeCompare(y.drive_title)));
    document.getElementById('fa-table').innerHTML = window.components.renderDataTable({
      columns: [
        ...(f.tab === 'REVIEW' ? [{ label: '', render: a => (a.state === 'RULE_EVALUATED' ? `<input type="checkbox" class="sel" value="${esc(a.application_id)}" aria-label="Select ${esc(a.student_name || a.student_id)}"/>` : '') }] : []),
        { label: 'Rank', render: a => (a.rank ? `<span class="rank-no ${a.rank <= 3 ? 'top' : ''}" title="score ${esc(fmt.num(a.rank_score, 3))}">${a.rank}</span>` : '<span class="muted">—</span>') },
        { label: 'Student', render: a => `<b>${esc(a.student_name || a.student_id)}</b><br><span class="muted small">${esc(a.student_id)} · ${esc(a.student_branch || '')} · CGPA ${esc(a.student_cgpa ?? '—')}</span>` },
        { label: 'Drive', render: a => `<b>${esc(a.drive_title)}</b><br><span class="muted small">${esc(a.company_name)}</span>` },
        { label: 'Eligibility', render: a => (a.eligibility_result ? window.components.renderEligibilityBadge(a.eligibility_result) + ((a.failed_rules || []).length ? `<div class="muted small" style="max-width:220px;">${esc(a.failed_rules[0])}</div>` : '') : '<span class="muted">—</span>') },
        { label: 'Status', render: a => `${window.components.renderBadge(a.state)}${a.pipeline_status === 'EVALUATION_PENDING' ? '<br><span class="chip amber">engine pending</span>' : ''}` },
        { label: 'Applied', render: a => esc(fmt.date(a.created_at)) },
        { label: 'Actions', render: a => `<div class="row-actions">${actionButtons(a)}<a class="btn btn-ghost btn-sm" href="${base}/applications/${esc(a.application_id)}">Details</a></div>` },
      ],
      rows, emptyMessage: 'No applications in this view.',
    });
    bindRows();
  };

  const refresh = () => window.views.faculty.renderApplications();
  const act = (btn, fn, success) => window.components.runAction(btn, fn, { success, refresh });

  function bindRows() {
    const sels = () => [...document.querySelectorAll('.sel:checked')].map(x => x.value);
    document.querySelectorAll('.sel').forEach(x => x.addEventListener('change', () => { document.getElementById('bulk-shortlist').disabled = sels().length === 0; }));
    document.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const app = apps.find(a => a.application_id === id);
      const who = app.student_name || app.student_id;
      switch (btn.dataset.act) {
        case 'shortlist': return act(btn, () => window.api.shortlistCandidate(id), `${who} shortlisted`);
        case 'waitlist': return act(btn, () => window.api.waitlistCandidate(id), `${who} waitlisted`);
        case 'select': return window.components.confirm({ title: 'Mark as selected?', message: `${who} is selected by the company. One seat is claimed from "${app.drive_title}".`, confirmText: 'Select', onConfirm: () => act(null, () => window.api.selectCandidate(id), `${who} selected`) });
        case 'reeval': return act(btn, () => window.api.reevaluate(id), 'Re-evaluation requested');
        case 'reject': return window.components.formModal({
          title: `Reject ${who}?`, intro: 'The student is notified. Seats and interview slots held for them are released.', submitText: 'Reject', submitClass: 'btn-danger',
          fields: [{ name: 'reason', label: 'Reason (shown to student)', type: 'textarea', full: true }],
          onSubmit: async (v) => { await window.api.rejectCandidate(id, v.reason); window.toast.success(`${who} rejected`); refresh(); } });
        case 'interview': return window.components.formModal({
          title: `Schedule interview — ${who}`, intro: 'The slot is reserved exclusively through the lease manager (Team A); a clash with another candidate is rejected.', submitText: 'Schedule',
          fields: [
            { name: 'round_name', label: 'Round', value: app.state === 'SHORTLISTED' ? 'Technical Interview' : 'HR Interview', required: true },
            { name: 'scheduled_at', label: 'Date & time', type: 'datetime-local', value: fmt.toLocalInput(), required: true },
            { name: 'mode', label: 'Mode', type: 'select', options: ['Online', 'On-campus'], value: 'Online' },
            { name: 'location_url', label: 'Meeting link / venue', value: 'https://meet.jit.si/rit-placement-' + id.slice(0, 6), full: true },
          ],
          onSubmit: async (v) => { await window.api.scheduleInterview(id, { ...v, scheduled_at: new Date(v.scheduled_at).toISOString() }); window.toast.success('Interview scheduled'); refresh(); } });
        case 'offer': return window.components.formModal({
          title: `Issue offer — ${who}`, intro: `${app.company_name} · ${app.drive_title}`, submitText: 'Issue offer',
          fields: [
            { name: 'package_ctc', label: 'Annual package (₹)', type: 'number', min: 1, value: app.package || 600000, required: true, help: 'e.g. 750000 = ₹7.5 LPA' },
            { name: 'joining_date', label: 'Joining date', type: 'date', value: '2026-07-01' },
            { name: 'role_title', label: 'Role title', value: app.drive_title, full: true },
          ],
          onSubmit: async (v) => { await window.api.issueOffer(id, v); window.toast.success('Offer issued'); refresh(); } });
        default:
      }
    }));
  }

  document.getElementById('fa-q').addEventListener('input', window.debounce(e => { f.q = e.target.value; draw(); }, 200));
  document.getElementById('fa-drive').addEventListener('change', e => { f.drive = e.target.value; draw(); });
  document.getElementById('fa-elig').addEventListener('change', e => { f.elig = e.target.value; draw(); });
  c.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => { f.tab = t.dataset.tab; refresh(); }));
  document.getElementById('bulk-shortlist').addEventListener('click', async (e) => {
    const ids = [...document.querySelectorAll('.sel:checked')].map(x => x.value);
    if (!ids.length) return;
    e.currentTarget.disabled = true;
    const results = await Promise.allSettled(ids.map(id => window.api.shortlistCandidate(id)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    window.toast[ok === ids.length ? 'success' : 'warning'](`${ok} of ${ids.length} shortlisted`);
    refresh();
  });
  draw();
};
