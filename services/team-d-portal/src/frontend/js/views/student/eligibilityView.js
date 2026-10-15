/**
 * Eligibility sandbox: evaluate yourself against any drive and compare Team A rule-chaining strategies.
 */
window.views = window.views || {};
window.views.student = window.views.student || {};

const STRATEGY_INFO = {
  DECISION_TREE: 'Walks a decision tree of rules; stops at the first failed branch.',
  SEQUENTIAL_AND: 'Evaluates a chain of rules in order; every hard rule must pass.',
  WEIGHTED_PRIORITY: 'Scores rules by weight; ≥70% weighted pass is conditional, 100% is eligible.',
};

window.views.student.renderEligibility = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const drives = (await window.api.getDrives()).filter(d => d.state !== 'DRAFT');
  const sel = window.__eligSel = window.__eligSel || {};
  const driveId = sel.driveId && drives.find(d => d.drive_id === sel.driveId) ? sel.driveId : (drives.find(d => d.state === 'OPEN') || drives[0] || {}).drive_id;

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Eligibility check', subtitle: 'See exactly which rules you pass or fail, and how different rule-chaining strategies judge you.',
      tags: [['A', 'rule engine & strategies'], ['C', 'your record']],
    })}
    <div class="card" style="margin-bottom:1.25rem;">
      <div class="row">
        <div class="form-group" style="flex:2;min-width:240px;"><label for="el-drive">Drive</label>
          <select id="el-drive" class="form-control">${drives.map(d => `<option value="${esc(d.drive_id)}" ${d.drive_id === driveId ? 'selected' : ''}>${esc(d.company?.name || '')} — ${esc(d.title)}${d.state !== 'OPEN' ? ` (${esc(d.state)})` : ''}</option>`).join('')}</select></div>
        <div class="form-group" style="flex:1;min-width:200px;"><label for="el-strategy">Strategy</label>
          <select id="el-strategy" class="form-control">${Object.keys(STRATEGY_INFO).map(s => `<option value="${s}" ${(sel.strategy || 'DECISION_TREE') === s ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}</select></div>
        <div style="align-self:flex-end;"><button id="el-run" class="btn btn-primary">Check eligibility</button> <button id="el-compare" class="btn btn-secondary">Compare strategies</button></div>
      </div>
      <p class="small muted" id="el-strategy-info" style="margin-top:.5rem;">${esc(STRATEGY_INFO[sel.strategy || 'DECISION_TREE'])}</p>
    </div>
    <div id="el-result">${drives.length ? '<p class="sub">Choose a drive and run the check.</p>' : window.components.emptyState('No drives available', 'Check back when drives are published.')}</div>`;

  const run = async (compare) => {
    const driveSel = document.getElementById('el-drive').value;
    const strategy = document.getElementById('el-strategy').value;
    window.__eligSel = { driveId: driveSel, strategy };
    const out = document.getElementById('el-result');
    out.innerHTML = window.components.skeleton(2);
    try {
      if (!compare) {
        const r = await window.api.checkEligibility(driveSel, null, strategy);
        out.innerHTML = `<div class="card"><div class="card-head"><h3>${esc(r.drive.title)}</h3>${window.components.teamTag('A')}</div>${window.components.eligibilityBreakdown(r.evaluation)}</div>`;
      } else {
        const results = await Promise.all(Object.keys(STRATEGY_INFO).map(s => window.api.checkEligibility(driveSel, null, s).then(r => ({ s, ev: r.evaluation, drive: r.drive }))));
        out.innerHTML = `<div class="card"><div class="card-head"><h3>Strategy comparison — ${esc(results[0].drive.title)}</h3>${window.components.teamTag('A', 'A2 experiment')}</div>
          <div class="table-responsive"><table class="data-table"><thead><tr><th>Strategy</th><th>Verdict</th><th>Failed rules</th><th>Eval time</th><th>How it works</th></tr></thead><tbody>
          ${results.map(({ s, ev }) => `<tr><td><b>${esc(s.replace(/_/g, ' '))}</b></td><td>${window.components.renderEligibilityBadge(ev.eligibility_result)}</td><td class="small">${(ev.failed_rules || []).map(esc).join('<br>') || '—'}</td><td>${esc(ev.decision_metrics?.evaluation_time_us ?? '—')} µs</td><td class="small muted">${esc(STRATEGY_INFO[s])}</td></tr>`).join('')}
          </tbody></table></div>
          <p class="small muted" style="margin-top:.75rem;">Differences show how the chosen policy changes outcomes for borderline profiles. The official application decision uses the default decision-tree strategy.</p></div>`;
      }
    } catch (e) {
      out.innerHTML = `<div class="alert error">${esc(window.components.errorText(e))}</div>`;
    }
  };
  document.getElementById('el-run').addEventListener('click', () => run(false));
  document.getElementById('el-compare').addEventListener('click', () => run(true));
  document.getElementById('el-strategy').addEventListener('change', e => { document.getElementById('el-strategy-info').textContent = STRATEGY_INFO[e.target.value]; });
  if (driveId) run(false);
};
