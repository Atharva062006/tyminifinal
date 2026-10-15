/**
 * Placement analytics: KPIs, pipeline, branch / company trends, package distribution and the Team B cohort
 * analysis with its time/space complexity evidence.
 */
window.views = window.views || {};
window.views.faculty = window.views.faculty || {};

window.views.faculty.renderAnalytics = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const f = window.__anF = window.__anF || { branch: 'ALL', algorithm: 'HASH_AGG' };
  const [a, students] = await Promise.all([
    window.api.getAnalytics({ branch: f.branch, algorithm: f.algorithm }),
    window.api.getStudents().catch(() => []),
  ]);
  const branches = [...new Set(students.map(s => s.branch))].sort();
  const k = a.kpis || {};
  const p = a.packages || {};
  const co = a.cohort;
  const ev = co?.complexity_evidence;

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Placement analytics', subtitle: 'Department trends, company conversion and package distribution for the current placement season.',
      tags: [['B', 'cohort analysis (B4)'], ['C', 'source data'], ['A', 'queue metrics']],
      actions: '<a class="btn btn-secondary btn-sm" href="#/faculty/reports">Reports &amp; export</a>',
    })}
    <div class="filter-bar">
      <label class="small muted" for="an-branch">Department</label>
      <select id="an-branch" class="form-control"><option value="ALL">All departments</option>${branches.map(b => `<option ${f.branch === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
      <label class="small muted" for="an-alg">Aggregation</label>
      <select id="an-alg" class="form-control"><option value="HASH_AGG" ${f.algorithm === 'HASH_AGG' ? 'selected' : ''}>Hash aggregation O(n)</option><option value="SORT_AGG" ${f.algorithm === 'SORT_AGG' ? 'selected' : ''}>Sort-then-scan O(n log n)</option></select>
    </div>
    <div class="kpi-grid">
      ${window.components.kpi({ label: 'Students', value: k.total_students })}
      ${window.components.kpi({ label: 'Applications', value: k.total_applications, tone: 'cyan' })}
      ${window.components.kpi({ label: 'Offers issued', value: k.offers_issued, tone: 'purple', meta: `${k.offer_conversion_pct ?? 0}% of applications` })}
      ${window.components.kpi({ label: 'Placed (accepted)', value: k.offers_accepted, tone: 'green', meta: `${k.placement_rate_pct ?? 0}% of students` })}
      ${window.components.kpi({ label: 'Average package', value: typeof p.average === 'number' ? fmt.money(p.average) : '—', tone: 'amber', meta: typeof p.highest === 'number' ? `highest ${fmt.money(p.highest)}` : '' })}
    </div>
    <div class="grid cols-2" style="margin-bottom:1.25rem;">
      ${window.components.renderFunnelChart(a.pipeline)}
      ${window.components.renderBarChart({ title: 'Applications by department', data: a.branch_breakdown, xKey: 'branch', yKey: 'applications', yLabel: 'applications' })}
    </div>
    <div class="grid cols-2" style="margin-bottom:1.25rem;">
      <div class="card"><div class="card-head"><h3>Department trend</h3>${window.components.teamTag('B', 'ranked by placed, tie-break by name')}</div>
        ${window.components.renderDataTable({ columns: [
          { label: 'Department', render: x => `<b>${esc(x.branch)}</b>` }, { label: 'Students', render: x => esc(x.students) }, { label: 'Applications', render: x => esc(x.applications) }, { label: 'Placed', render: x => esc(x.placed) },
          { label: 'Rate', render: x => `<div class="row" style="gap:.4rem;flex-wrap:nowrap;"><div class="score-bar" style="width:70px;"><div style="width:${Math.min(100, x.placement_rate_pct)}%"></div></div><b>${esc(x.placement_rate_pct)}%</b></div>` },
        ], rows: co?.department_trend || [], emptyMessage: 'No data.' })}
      </div>
      <div class="card"><div class="card-head"><h3>Company conversion</h3>${window.components.teamTag('B')}</div>
        ${window.components.renderDataTable({ columns: [
          { label: 'Company / role', render: x => `<b>${esc(x.company_name)}</b><br><span class="muted small">${esc(x.title)}</span>` }, { label: 'Applied', render: x => esc(x.applications) }, { label: 'Shortlisted+', render: x => esc(x.shortlisted) }, { label: 'Placed', render: x => esc(x.placed) }, { label: 'Conversion', render: x => `<b>${esc(x.conversion_pct)}%</b>` },
        ], rows: co?.company_conversion || [], emptyMessage: 'No data.' })}
      </div>
    </div>
    <div class="grid cols-2" style="margin-bottom:1.25rem;">
      <div class="card"><div class="card-head"><h3>Package distribution</h3></div>
        ${(p.distribution || []).length ? p.distribution.map(t => { const max = Math.max(...p.distribution.map(x => x.count), 1); return `<div class="row between small"><span>${esc(t.tier)}</span><b>${esc(t.count)}</b></div><div class="score-bar" style="margin-bottom:.6rem;"><div style="width:${(t.count / max) * 100}%"></div></div>`; }).join('') : '<p class="sub">No offers yet — distribution appears once candidates are selected.</p>'}
        ${co?.package_distribution?.count ? `<dl class="kv small" style="margin-top:.75rem;"><dt>Median</dt><dd>${esc(fmt.money(co.package_distribution.median))}</dd><dt>Min / Max</dt><dd>${esc(fmt.money(co.package_distribution.min))} / ${esc(fmt.money(co.package_distribution.max))}</dd></dl>` : ''}
      </div>
      <div class="card"><div class="card-head"><h3>Skill demand vs supply</h3>${window.components.teamTag('B')}</div>
        ${window.components.renderDataTable({ columns: [
          { label: 'Skill', render: x => `<b>${esc(x.skill)}</b>` }, { label: 'Drives requiring', render: x => esc(x.drives_requiring) }, { label: 'Students with skill', render: x => esc(x.students_with_skill) },
          { label: 'Gap', render: x => { const g = x.drives_requiring - x.students_with_skill; return `<span class="chip ${g > 0 ? 'rose' : 'green'}">${g > 0 ? '+' + g + ' short' : 'covered'}</span>`; } },
        ], rows: co?.skill_gap || [], emptyMessage: 'No skill requirements recorded.' })}
      </div>
    </div>
    ${ev ? `<div class="card"><div class="card-head"><h3>Complexity evidence</h3>${window.components.teamTag('B', 'time & space')}</div>
      <dl class="kv"><dt>Algorithm</dt><dd><b>${esc(ev.algorithm)}</b></dd><dt>Input size</dt><dd>${esc(ev.input_size)} applications</dd><dt>Elapsed</dt><dd>${esc(ev.elapsed_ms)} ms</dd><dt>Time complexity</dt><dd class="mono">${esc(ev.time_complexity)}</dd><dt>Space complexity</dt><dd class="mono">${esc(ev.space_complexity)}</dd><dt>Tie-break rule</dt><dd>${esc(ev.tie_break_rule)}</dd></dl></div>` : ''}`;

  document.getElementById('an-branch').addEventListener('change', e => { f.branch = e.target.value; window.views.faculty.renderAnalytics(); });
  document.getElementById('an-alg').addEventListener('change', e => { f.algorithm = e.target.value; window.views.faculty.renderAnalytics(); });
};
