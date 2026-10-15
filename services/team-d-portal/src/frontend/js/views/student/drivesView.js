/**
 * Student drive discovery: search / filter drives and see live eligibility (Team A) per drive.
 */
window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student._driveCard = function (d) {
  const crit = d.criteria || {};
  const mine = d.my_application;
  const el = d.my_eligibility;
  const seatsTotal = d.seats_total || d.seats || 1;
  const filled = Math.max(0, seatsTotal - d.seats);
  const deadline = d.deadline ? new Date(d.deadline) : null;
  const closing = deadline && (deadline - Date.now()) < 7 * 86400000 && deadline > Date.now();
  let cta;
  if (mine && !['WITHDRAWN', 'REJECTED', 'NOT_ELIGIBLE', 'OFFER_DECLINED'].includes(mine.state)) cta = `<a class="btn btn-secondary btn-sm" href="#/student/applications/${esc(mine.application_id)}">Applied · ${esc(mine.state.replace(/_/g, ' '))}</a>`;
  else if (d.state !== 'OPEN') cta = `<span class="badge badge-closed">${esc(d.state)}</span>`;
  else cta = `<a class="btn btn-primary btn-sm" href="#/student/drives/${esc(d.drive_id)}">${el && el.result === 'NOT_ELIGIBLE' ? 'View requirements' : 'View & apply'}</a>`;
  return `
    <article class="drive-card">
      <div class="co">${window.components.companyLogo(d.company?.name)}<div style="min-width:0;"><h3>${esc(d.title)}</h3><span class="muted small">${esc(d.company?.name || '—')} · ${esc(d.company?.industry || '')}</span></div></div>
      <div class="facts">
        <span class="fact">${esc(fmt.money(d.package))}</span>
        ${d.location ? `<span class="fact">📍 ${esc(d.location)}</span>` : ''}
        <span class="fact">CGPA ≥ ${esc(crit.min_cgpa ?? '—')}</span>
        <span class="fact">Backlogs ≤ ${esc(crit.max_backlogs ?? '—')}</span>
        ${(crit.branches || []).length ? `<span class="fact">${esc(crit.branches.join(' / '))}</span>` : ''}
      </div>
      <div class="facts">${(crit.required_skills || []).map(s => `<span class="chip">${esc(s)}</span>`).join('')}</div>
      <div>
        <div class="row between small muted"><span>${esc(d.seats)} of ${esc(seatsTotal)} seats left</span>${closing ? `<span style="color:var(--accent-amber);font-weight:700;">Closes ${esc(fmt.date(d.deadline))}</span>` : (d.deadline ? `<span>Deadline ${esc(fmt.date(d.deadline))}</span>` : '')}</div>
        <div class="seat-bar" style="margin-top:.3rem;"><div style="width:${Math.round((filled / seatsTotal) * 100)}%"></div></div>
      </div>
      <div class="row between">
        <span>${el ? `${window.components.renderEligibilityBadge(el.result)} <span class="muted small">for you</span>` : '<span class="muted small">Eligibility on open drives</span>'}</span>
        ${cta}
      </div>
    </article>`;
};

window.views.student.renderDrives = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const drives = await window.api.getDrives();
  const branches = [...new Set(drives.flatMap(d => (d.criteria?.branches || [])))].sort();
  const state = window.__driveFilters = window.__driveFilters || { q: '', branch: '', minPkg: '', status: 'OPEN', elig: '', hideApplied: false };

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Drives & companies',
      subtitle: 'Eligibility is evaluated live by the rule engine for your profile — apply to the drives that fit.',
      tags: [['C', 'drives & seats'], ['A', 'eligibility per drive']],
    })}
    <div class="filter-bar" role="search">
      <input id="df-q" class="form-control" style="flex:2;min-width:200px;" type="search" placeholder="Search company or role…" value="${esc(state.q)}" aria-label="Search drives"/>
      <select id="df-branch" class="form-control" aria-label="Branch"><option value="">All branches</option>${branches.map(b => `<option ${state.branch === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
      <select id="df-pkg" class="form-control" aria-label="Minimum package"><option value="">Any package</option>${[4, 6, 8, 10].map(p => `<option value="${p * 100000}" ${String(state.minPkg) === String(p * 100000) ? 'selected' : ''}>≥ ₹${p} LPA</option>`).join('')}</select>
      <select id="df-status" class="form-control" aria-label="Status"><option value="OPEN" ${state.status === 'OPEN' ? 'selected' : ''}>Open drives</option><option value="" ${state.status === '' ? 'selected' : ''}>All drives</option><option value="CLOSED" ${state.status === 'CLOSED' ? 'selected' : ''}>Closed</option></select>
      <select id="df-elig" class="form-control" aria-label="Eligibility"><option value="">Any eligibility</option><option value="ELIGIBLE" ${state.elig === 'ELIGIBLE' ? 'selected' : ''}>Eligible for me</option><option value="CONDITIONAL" ${state.elig === 'CONDITIONAL' ? 'selected' : ''}>Conditional</option></select>
      <label class="check"><input id="df-hide" type="checkbox" ${state.hideApplied ? 'checked' : ''}/> Hide applied</label>
    </div>
    <div id="drive-results" aria-live="polite"></div>`;

  const draw = () => {
    const q = state.q.toLowerCase();
    const list = drives.filter(d =>
      (!q || `${d.title} ${d.company?.name || ''}`.toLowerCase().includes(q)) &&
      (!state.branch || (d.criteria?.branches || []).length === 0 || d.criteria.branches.includes(state.branch)) &&
      (!state.minPkg || (d.package || 0) >= Number(state.minPkg)) &&
      (!state.status || d.state === state.status) &&
      (!state.elig || d.my_eligibility?.result === state.elig) &&
      (!state.hideApplied || !d.my_application));
    document.getElementById('drive-results').innerHTML = list.length
      ? `<p class="small muted" style="margin-bottom:.6rem;">${list.length} drive${list.length === 1 ? '' : 's'}</p><div class="drive-grid">${list.map(window.views.student._driveCard).join('')}</div>`
      : window.components.emptyState('No drives match your filters', 'Try clearing a filter or searching a different company.', '<button class="btn btn-secondary btn-sm" id="df-clear">Clear filters</button>');
    document.getElementById('df-clear')?.addEventListener('click', () => { Object.assign(state, { q: '', branch: '', minPkg: '', status: 'OPEN', elig: '', hideApplied: false }); window.views.student.renderDrives(); });
  };
  const bind = (id, key, ev = 'change', cast = v => v) => document.getElementById(id).addEventListener(ev, e => { state[key] = cast(e.target.type === 'checkbox' ? e.target.checked : e.target.value); draw(); });
  bind('df-q', 'q', 'input'); bind('df-branch', 'branch'); bind('df-pkg', 'minPkg'); bind('df-status', 'status'); bind('df-elig', 'elig'); bind('df-hide', 'hideApplied');
  draw();
};
