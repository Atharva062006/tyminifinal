/**
 * Student ranking view: your standing per drive. Other candidates are anonymised by the BFF.
 */
window.views = window.views || {};
window.views.student = window.views.student || {};

window.views.student.renderRankings = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const user = window.store.get('user');
  const [drives, myApps] = await Promise.all([window.api.getDrives(), window.api.getApplications()]);
  const applied = drives.filter(d => myApps.some(a => a.drive_id === d.drive_id));
  const list = applied.length ? applied : drives.filter(d => d.state === 'OPEN');
  const sel = window.__rankSel = window.__rankSel || {};
  const driveId = list.find(d => d.drive_id === sel.driveId)?.drive_id || list[0]?.drive_id;
  const algorithm = sel.algorithm || 'WEIGHTED_SCORE';

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'My ranking', subtitle: 'How the ranking engine scores you against other eligible applicants. Names of other students are hidden.',
      tags: [['B', 'skill graph + Top-K'], ['C', 'applicant pool']],
    })}
    ${list.length ? `
    <div class="filter-bar">
      <select id="rk-drive" class="form-control" aria-label="Drive">${list.map(d => `<option value="${esc(d.drive_id)}" ${d.drive_id === driveId ? 'selected' : ''}>${esc(d.company?.name || '')} — ${esc(d.title)}</option>`).join('')}</select>
      <select id="rk-alg" class="form-control" aria-label="Algorithm">${['WEIGHTED_SCORE', 'HEAP_TOPK', 'MERGE_SORT'].map(a => `<option ${a === algorithm ? 'selected' : ''} value="${a}">${a.replace(/_/g, ' ')}</option>`).join('')}</select>
      <span class="small muted">All algorithms return the same order — they differ only in how they compute it.</span>
    </div>
    <div id="rk-result">${window.components.skeleton(2)}</div>` : window.components.emptyState('Nothing to rank yet', 'Apply to a drive to see where you stand.', '<a class="btn btn-primary btn-sm" href="#/student/drives">Find a drive</a>')}`;

  if (!list.length) return;
  const load = async () => {
    const out = document.getElementById('rk-result');
    const d = document.getElementById('rk-drive').value;
    const a = document.getElementById('rk-alg').value;
    window.__rankSel = { driveId: d, algorithm: a };
    out.innerHTML = window.components.skeleton(2);
    try {
      const r = await window.api.getRankings(d, a);
      const me = (r.rankings || []).find(x => x.student_id === user.id);
      out.innerHTML = `
        ${r.degraded ? '<div class="alert warn"><div>Ranking engine is unavailable — scores are not shown. Your application is not affected.</div></div>' : ''}
        <div class="grid cols-3" style="margin-bottom:1.25rem;">
          <div class="kpi">${'<div class="k-label">Your rank</div>'}<div class="k-value">${me ? '#' + esc(me.rank) : '—'}</div><div class="k-meta">${me ? `of ${esc(r.rankings.length)} ranked candidates` : (r.pool === 'ALL_STUDENTS' ? 'Not an applicant yet — preview of all students' : 'Not ranked (not eligible or not applied)')}</div></div>
          <div class="kpi purple"><div class="k-label">Your score</div><div class="k-value">${me && me.total_score != null ? esc(fmt.num(me.total_score, 3)) : '—'}</div><div class="k-meta">weighted: CGPA ${esc(r.weights?.cgpa)}, skills ${esc(r.weights?.skills)}, attendance ${esc(r.weights?.attendance)}</div></div>
          <div class="kpi cyan"><div class="k-label">Seats</div><div class="k-value">${esc(r.seats)}</div><div class="k-meta">${esc(r.pool === 'APPLICANTS' ? 'applicant pool' : 'preview pool')} · graph ${esc(r.graph_version || '—')}</div></div>
        </div>
        ${me ? `<div class="card" style="margin-bottom:1.25rem;"><div class="card-head"><h3>Why this score</h3>${window.components.teamTag('B', 'score breakdown')}</div>
          ${Object.entries(me.score_breakdown || {}).map(([k, v]) => `<div class="row between small"><span>${esc(k.replace(/_/g, ' '))}</span><b>${esc(fmt.num(v, 3))}</b></div><div class="score-bar" style="margin-bottom:.5rem;"><div style="width:${Math.min(100, v * 250)}%"></div></div>`).join('')}
          ${(me.missing_skills || []).length ? `<p class="small">Add these skills to improve your match: ${me.missing_skills.map(s => `<span class="chip amber">${esc(s)}</span>`).join(' ')} <a class="link" href="#/student/profile">Edit profile</a></p>` : ''}</div>` : ''}
        <div class="card"><div class="card-head"><h3>Leaderboard (anonymised)</h3><span class="small muted">${esc(r.algorithm.replace(/_/g, ' '))} · ${esc(r.computation_time_ms ?? '—')} ms${r.cache_hit ? ' · cached' : ''}</span></div>
          ${window.components.renderDataTable({ columns: [
            { label: 'Rank', render: x => `<span class="rank-no ${x.rank <= 3 ? 'top' : ''}">${esc(x.rank)}</span>` },
            { label: 'Candidate', render: x => (x.student_id === user.id ? '<b>You</b>' : esc(x.name || 'Candidate')) },
            { label: 'Score', render: x => `<div class="row" style="gap:.5rem;"><div class="score-bar" style="width:120px;"><div style="width:${Math.min(100, (x.total_score || 0) * 100)}%"></div></div><span class="small">${esc(fmt.num(x.total_score, 3))}</span></div>` },
          ], rows: r.rankings || [], emptyMessage: 'No ranked candidates yet.' })}
        </div>`;
    } catch (e) { out.innerHTML = `<div class="alert error">${esc(window.components.errorText(e))}</div>`; }
  };
  document.getElementById('rk-drive').addEventListener('change', load);
  document.getElementById('rk-alg').addEventListener('change', load);
  load();
};
