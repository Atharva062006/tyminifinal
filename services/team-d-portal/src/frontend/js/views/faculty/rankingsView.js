/**
 * Staff ranking console: compute rankings per drive with selectable algorithm and weight vector (Team B),
 * compare algorithms, inspect score breakdowns and shortlist directly from the leaderboard (Team C).
 */
window.views = window.views || {};
window.views.faculty = window.views.faculty || {};

window.views.faculty.renderRankings = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const drives = (await window.api.getDrives()).filter(d => d.state !== 'DRAFT');
  const st = window.__rkStaff = window.__rkStaff || { weights: { cgpa: 0.4, skills: 0.4, attendance: 0.2 }, algorithm: 'WEIGHTED_SCORE' };
  const driveId = drives.find(d => d.drive_id === st.driveId)?.drive_id || drives[0]?.drive_id;

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Ranking console', subtitle: 'Rank applicants with the skill-graph engine. Results are reproducible: the response carries the graph version and the tie-break rule.',
      tags: [['B', 'graph ranking · heap Top-K · merge sort'], ['C', 'applicant pool']],
    })}
    ${drives.length ? `
    <div class="card" style="margin-bottom:1.25rem;">
      <div class="form-grid" style="grid-template-columns:repeat(4,minmax(0,1fr));">
        <div class="form-group" style="grid-column:span 2;"><label for="rk-drive">Drive</label><select id="rk-drive" class="form-control">${drives.map(d => `<option value="${esc(d.drive_id)}" ${d.drive_id === driveId ? 'selected' : ''}>${esc(d.company?.name || '')} — ${esc(d.title)}</option>`).join('')}</select></div>
        <div class="form-group"><label for="rk-alg">Algorithm</label><select id="rk-alg" class="form-control">${['WEIGHTED_SCORE', 'HEAP_TOPK', 'MERGE_SORT'].map(a => `<option value="${a}" ${st.algorithm === a ? 'selected' : ''}>${a.replace(/_/g, ' ')}</option>`).join('')}</select></div>
        <div class="form-group"><label>&nbsp;</label><div class="row"><button class="btn btn-primary" id="rk-run">Compute</button><button class="btn btn-secondary" id="rk-cmp">Compare algorithms</button></div></div>
        <div class="form-group"><label for="w-cgpa">Weight: CGPA</label><input id="w-cgpa" class="form-control" type="number" step="0.05" min="0" max="1" value="${st.weights.cgpa}"/></div>
        <div class="form-group"><label for="w-skills">Weight: skills match</label><input id="w-skills" class="form-control" type="number" step="0.05" min="0" max="1" value="${st.weights.skills}"/></div>
        <div class="form-group"><label for="w-att">Weight: attendance</label><input id="w-att" class="form-control" type="number" step="0.05" min="0" max="1" value="${st.weights.attendance}"/></div>
        <div class="form-group"><label>Weight total</label><div class="row"><b id="w-sum">1.00</b><button class="link small" id="w-norm" type="button">Normalise</button></div><div class="form-help">Must sum to 1.0 or the engine rejects the vector.</div></div>
      </div>
    </div>
    <div id="rk-out">${window.components.emptyState('Choose a drive', 'Press Compute to rank its applicants.')}</div>`
    : window.components.emptyState('No drives', 'Create a drive first.')}`;
  if (!drives.length) return;

  const weights = () => ({ cgpa: Number(document.getElementById('w-cgpa').value), skills: Number(document.getElementById('w-skills').value), attendance: Number(document.getElementById('w-att').value) });
  const sync = () => { const w = weights(); const s = w.cgpa + w.skills + w.attendance; const el = document.getElementById('w-sum'); el.textContent = s.toFixed(2); el.style.color = Math.abs(s - 1) > 0.01 ? 'var(--accent-rose)' : 'var(--accent-emerald)'; };
  ['w-cgpa', 'w-skills', 'w-att'].forEach(id => document.getElementById(id).addEventListener('input', sync));
  document.getElementById('w-norm').addEventListener('click', () => { const w = weights(); const s = w.cgpa + w.skills + w.attendance || 1; document.getElementById('w-cgpa').value = (w.cgpa / s).toFixed(2); document.getElementById('w-skills').value = (w.skills / s).toFixed(2); document.getElementById('w-att').value = (1 - (w.cgpa / s).toFixed(2) - (w.skills / s).toFixed(2)).toFixed(2); sync(); });
  sync();

  const run = async () => {
    const out = document.getElementById('rk-out');
    const drive = document.getElementById('rk-drive').value;
    const algorithm = document.getElementById('rk-alg').value;
    st.driveId = drive; st.algorithm = algorithm; st.weights = weights();
    out.innerHTML = window.components.skeleton(2);
    try {
      const r = await window.api.previewRanking(drive, algorithm, st.weights);
      const d = drives.find(x => x.drive_id === drive);
      const top = (r.rankings || []).slice(0, r.seats || 5).filter(x => x.application_state === 'RULE_EVALUATED' || x.application_state === 'WAITLISTED');
      out.innerHTML = `
        ${r.degraded ? `<div class="alert warn"><div>${esc(r.degraded_message || 'Ranking engine unavailable — showing unranked pool.')}</div></div>` : ''}
        <div class="kpi-grid">
          ${window.components.kpi({ label: 'Ranked', value: (r.rankings || []).length, meta: `${esc(r.pool === 'APPLICANTS' ? 'eligible applicants' : 'preview: all students (no applicants yet)')}` })}
          ${window.components.kpi({ label: 'Disqualified', value: (r.disqualified || []).length, tone: 'rose', meta: 'fail drive cut-offs' })}
          ${window.components.kpi({ label: 'Compute time', value: `${esc(r.computation_time_ms ?? '—')} ms`, tone: 'cyan', meta: r.cache_hit ? 'served from cache' : 'computed' })}
          ${window.components.kpi({ label: 'Graph version', value: esc(r.graph_version || '—'), tone: 'purple', meta: esc(r.ranking_id || '') })}
        </div>
        <div class="card">
          <div class="card-head"><h3>${esc(d?.title || '')} — leaderboard</h3><div class="row"><span class="small muted">Tie-break: ${esc(r.tie_break_rule || '—')}</span>${top.length ? `<button class="btn btn-success btn-sm" id="shortlist-top">Shortlist top ${top.length} (seats)</button>` : ''}</div></div>
          ${window.components.renderDataTable({
            columns: [
              { label: '#', render: x => `<span class="rank-no ${x.rank <= 3 ? 'top' : ''}">${esc(x.rank)}</span>` },
              { label: 'Candidate', render: x => `<b>${esc(x.name || x.student_id)}</b><br><span class="muted small">${esc(x.student_id)} · ${esc(x.branch || '')} · CGPA ${esc(x.cgpa)}</span>` },
              { label: 'Score', render: x => `<div class="row" style="gap:.5rem;flex-wrap:nowrap;"><div class="score-bar" style="width:90px;"><div style="width:${Math.min(100, (x.total_score || 0) * 100)}%"></div></div><b>${esc(fmt.num(x.total_score, 3))}</b></div>` },
              { label: 'Breakdown', render: x => `<span class="small muted">CGPA ${esc(fmt.num(x.score_breakdown?.cgpa_component, 2))} · skills ${esc(fmt.num(x.score_breakdown?.skills_component, 2))} · att. ${esc(fmt.num(x.score_breakdown?.attendance_component, 2))}</span>` },
              { label: 'Skills', render: x => `${(x.matched_skills || []).map(s => `<span class="chip green">${esc(s)}</span>`).join(' ')} ${(x.missing_skills || []).map(s => `<span class="chip gray">${esc(s)}</span>`).join(' ')}` },
              { label: 'Application', render: x => (x.application_id ? `${window.components.renderBadge(x.application_state)}` : '<span class="muted small">not applied</span>') },
              { label: '', render: x => (['RULE_EVALUATED', 'WAITLISTED'].includes(x.application_state) ? `<button class="btn btn-success btn-sm" data-sl="${esc(x.application_id)}">Shortlist</button>` : '') },
            ],
            rows: r.rankings || [], emptyMessage: 'No qualified candidates for this drive.',
          })}
          ${(r.disqualified || []).length ? `<details style="margin-top:1rem;"><summary class="link small">Disqualified candidates (${r.disqualified.length})</summary>${r.disqualified.map(x => `<div class="list-item small"><b>${esc(x.name || x.student_id)}</b><span class="muted">${esc((x.reasons || []).join('; '))}</span></div>`).join('')}</details>` : ''}
        </div>`;
      document.getElementById('shortlist-top')?.addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        const res = await Promise.allSettled(top.map(x => window.api.shortlistCandidate(x.application_id)));
        window.toast.success(`${res.filter(x => x.status === 'fulfilled').length} of ${top.length} shortlisted`);
        run();
      });
      out.querySelectorAll('[data-sl]').forEach(b => b.addEventListener('click', () => window.components.runAction(b, () => window.api.shortlistCandidate(b.dataset.sl), { success: 'Shortlisted', refresh: run })));
    } catch (e) {
      out.innerHTML = `<div class="alert error"><div><b>Ranking failed.</b> ${esc(window.components.errorText(e))}</div></div>`;
    }
  };

  document.getElementById('rk-run').addEventListener('click', run);
  document.getElementById('rk-cmp').addEventListener('click', async () => {
    const out = document.getElementById('rk-out');
    const drive = document.getElementById('rk-drive').value;
    out.innerHTML = window.components.skeleton(2);
    try {
      const algs = ['WEIGHTED_SCORE', 'HEAP_TOPK', 'MERGE_SORT'];
      const rs = await Promise.all(algs.map(a => window.api.previewRanking(drive, a, weights())));
      const orders = rs.map(r => (r.rankings || []).map(x => x.student_id).join(','));
      const same = orders.every(o => o === orders[0]);
      out.innerHTML = `<div class="card"><div class="card-head"><h3>Algorithm comparison</h3>${window.components.teamTag('B', 'B2 experiment')}</div>
        <div class="alert ${same ? 'ok' : 'error'}"><div>${same ? '<b>Identical ordering</b> across all three algorithms (0 score deviation from the reference).' : '<b>Orderings differ!</b> This should never happen — please report it.'}</div></div>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>Algorithm</th><th>Ranked</th><th>Compute time</th><th>Cache</th><th>Top 3</th><th>Complexity</th></tr></thead><tbody>
        ${rs.map((r, i) => `<tr><td><b>${algs[i].replace(/_/g, ' ')}</b></td><td>${(r.rankings || []).length}</td><td>${esc(r.computation_time_ms ?? '—')} ms</td><td>${r.cache_hit ? 'hit' : 'miss'}</td><td class="small">${(r.rankings || []).slice(0, 3).map(x => esc(x.name || x.student_id)).join(', ')}</td><td class="small muted">${['O(n log n) comparison sort', 'O(n log k) bounded min-heap', 'O(n log n) stable merge'][i]}</td></tr>`).join('')}
        </tbody></table></div></div>`;
    } catch (e) { out.innerHTML = `<div class="alert error">${esc(window.components.errorText(e))}</div>`; }
  });
  run();
};
