/**
 * System & engines console: live health of all four services plus the operational controls and
 * KPI evidence for Team A (queues, locks, deadlocks), Team B (benchmarks, index, cache) and Team C (recovery, reconciliation).
 */
window.views = window.views || {};
window.views.admin = window.views.admin || {};

window.views.admin.renderSystem = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const role = window.store.get('user').role;
  const isAdmin = role === 'admin';
  const tab = window.__sysTab = window.__sysTab || 'overview';
  const health = await window.api.getSystemHealth();
  const svc = Object.fromEntries(health.services.map(s => [s.key, s]));

  const tabs = [{ id: 'overview', label: 'Overview' }, { id: 'a', label: 'Team A · Eligibility & locks' }, { id: 'b', label: 'Team B · Ranking & index' }, { id: 'c', label: 'Team C · Database & recovery' }];
  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'System & engines', subtitle: `Probed in ${health.probe_ms} ms · ${fmt.dateTime(health.timestamp)}. Health alone is not enough — each engine API is exercised.`,
      tags: [['A', 'OS engine'], ['B', 'DS engine'], ['C', 'DBMS'], ['D', 'portal']],
      actions: '<button class="btn btn-secondary btn-sm" id="sys-refresh">Refresh</button>',
    })}
    ${window.components.tabs(tabs, tab)}
    <div id="sys-body"></div>`;

  const body = document.getElementById('sys-body');
  const out = (id, html) => { document.getElementById(id).innerHTML = html; };
  const table = (rows, cols) => `<div class="table-responsive"><table class="data-table"><thead><tr>${cols.map(x => `<th>${x[0]}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(x => `<td>${x[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const run = (btn, id, fn, render) => window.components.runAction(btn, async () => { out(id, window.components.skeleton(1)); const r = await fn(); out(id, render(r)); return r; }, { success: null });

  const panels = {
    overview() {
      body.innerHTML = `
        <div class="grid cols-2">${health.services.map(s => `
          <div class="card"><div class="card-head"><div class="row">${window.components.teamTag(s.key.slice(-1).toUpperCase())}<h3>${esc(s.name.split('—')[1] || s.name)}</h3></div><span class="mode-badge mode-${esc(s.mode)}">${esc(s.mode)}</span></div>
            <p class="sub small">${esc(s.role)}</p>
            <dl class="kv small"><dt>Port</dt><dd>${esc(s.port)}</dd><dt>Status</dt><dd>${esc(s.status)}${s.error ? ` — ${esc(s.error)}` : ''}</dd>
            ${s.key === 'team_a' && s.metrics ? `<dt>Queue policy</dt><dd>${esc(s.metrics.queue_policy)}</dd><dt>p95 decision</dt><dd>${esc(s.metrics.p95_decision_latency_ms)} ms</dd><dt>Evaluated</dt><dd>${esc(s.metrics.requests?.completed ?? '—')}</dd><dt>Active leases</dt><dd>${esc(s.metrics.active_leases)}</dd>` : ''}
            ${s.key === 'team_b' && s.metrics ? `<dt>Graph</dt><dd>${esc(s.metrics.graph_version)} · ${esc(s.metrics.graph?.students ?? 0)} students / ${esc(s.metrics.graph?.drives ?? 0)} drives</dd><dt>p95 ranking</dt><dd>${esc(s.metrics.p95_ranking_latency_ms)} ms</dd><dt>Cache hit rate</dt><dd>${esc(s.metrics.cache_hit_rate_pct)}%</dd>` : ''}
            ${s.key === 'team_d' ? `<dt>Uptime</dt><dd>${esc(Math.round(health.gateway.uptime_seconds / 60))} min</dd>` : ''}
            </dl>
            ${s.mode === 'FALLBACK' || s.mode === 'MOCK' ? '<div class="alert warn" style="margin:.75rem 0 0;"><div>This service is answered by a local mock / fallback. Start the real service to get live data.</div></div>' : ''}
          </div>`).join('')}</div>`;
    },

    a() {
      body.innerHTML = `
        <div class="grid cols-2">
          <div class="card"><div class="card-head"><h3>Queue policy</h3>${window.components.teamTag('A', 'A1 scheduler')}</div>
            <p class="sub small">Per-drive queues served round-robin. Aging prevents starvation under any policy.</p>
            <div class="row"><select id="qp" class="form-control" style="width:auto;" ${isAdmin ? '' : 'disabled'}>${['FIFO', 'CIRCULAR', 'PRIORITY', 'HEAP'].map(p => `<option>${p}</option>`).join('')}</select>${isAdmin ? '<button class="btn btn-primary btn-sm" id="qp-save">Apply policy</button>' : ''}<span id="qp-msg" class="small"></span></div></div>
          <div class="card"><div class="card-head"><h3>Active slot leases</h3>${window.components.teamTag('A', 'A3 lock manager')}</div><div id="locks-out">${window.components.skeleton(1)}</div></div>
        </div>
        ${isAdmin ? `<div class="card" style="margin-top:1.25rem;"><div class="card-head"><h3>Benchmark: rule strategies, slot safety, deadlocks</h3>${window.components.teamTag('A', 'KPI evidence')}<button class="btn btn-primary btn-sm" id="a-bench">Run benchmark</button></div><div id="a-bench-out"><p class="sub">Compares decision-tree / sequential-AND / weighted-priority on 1,000 synthetic students, then fires 10,000 concurrent exclusive-slot attempts and seeded deadlock cycles.</p></div></div>
        <div class="card" style="margin-top:1.25rem;"><div class="card-head"><h3>Deadlock analyser</h3>${window.components.teamTag('A', 'wait-for graph')}</div>
          <p class="sub small">Enter wait-for edges as <span class="mono">A-&gt;B, B-&gt;C, C-&gt;A</span> (A waits for B).</p>
          <div class="row"><input id="dl-edges" class="form-control" style="flex:1;" value="A->B, B->C, C->A"/><button class="btn btn-secondary btn-sm" id="dl-run">Analyse</button></div><div id="dl-out" style="margin-top:.75rem;"></div></div>` : ''}`;
      window.api.getQueuePolicy().then(p => { const el = document.getElementById('qp'); if (el) el.value = p.policy; }).catch(() => {});
      window.api.getLocks().then(l => out('locks-out', (l.leases || []).length ? table(l.leases, [['Slot', x => `<span class="mono small">${esc(x.slot_id)}</span>`], ['Holder', x => esc(x.holder_id)], ['Mode', x => esc(x.mode)], ['Expires', x => esc(fmt.dateTime(x.expires_at))]]) : '<p class="sub">No active leases.</p>')).catch(e => out('locks-out', `<div class="alert warn">${esc(window.components.errorText(e))}</div>`));
      document.getElementById('qp-save')?.addEventListener('click', (e) => window.components.runAction(e.currentTarget, () => window.api.setQueuePolicy(document.getElementById('qp').value), { success: 'Queue policy updated' }));
      document.getElementById('a-bench')?.addEventListener('click', (e) => run(e.currentTarget, 'a-bench-out', () => window.api.runBenchmark('team-a', { n: 1000, attempts: 10000 }), (r) => `
        ${table(r.rule_strategy_comparison, [['Strategy', x => `<b>${esc(x.strategy.replace(/_/g, ' '))}</b>`], ['Evaluated', x => esc(x.evaluated)], ['Throughput', x => `${esc(x.throughput_per_sec)}/s`], ['p95 latency', x => `${esc(x.p95_latency_ms)} ms`], ['Accuracy vs reference', x => `<b>${esc(x.accuracy_vs_reference_pct)}%</b>`]])}
        <dl class="kv" style="margin-top:1rem;"><dt>Slot safety</dt><dd><b>${esc(r.slot_allocation_safety.duplicate_exclusive_allocations)}</b> duplicate allocations in ${esc(r.slot_allocation_safety.attempts)} concurrent attempts <span class="chip ${r.slot_allocation_safety.duplicate_exclusive_allocations === 0 ? 'green' : 'rose'}">${r.slot_allocation_safety.duplicate_exclusive_allocations === 0 ? 'KPI met' : 'FAILED'}</span></dd>
        <dt>Deadlocks</dt><dd>${esc(r.deadlock_detection.detected)} of ${esc(r.deadlock_detection.seeded_cycles)} seeded cycles detected, ${esc(r.deadlock_detection.false_positives)} false positives <span class="chip ${r.deadlock_detection.detected === r.deadlock_detection.seeded_cycles ? 'green' : 'rose'}">${r.deadlock_detection.detected === r.deadlock_detection.seeded_cycles ? 'KPI met' : 'FAILED'}</span></dd></dl>`));
      document.getElementById('dl-run')?.addEventListener('click', (e) => run(e.currentTarget, 'dl-out', () => window.api.analyseDeadlocks(document.getElementById('dl-edges').value.split(',').map(s => s.trim().split(/->|→/).map(x => x.trim())).filter(p => p.length === 2 && p[0] && p[1])), (r) => `<div class="alert ${r.deadlock_detected ? 'error' : 'ok'}"><div>${r.deadlock_detected ? `<b>Deadlock detected.</b> Cycles: ${r.cycles.map(cy => cy.join(' → ')).join(' | ')}. Recovery: abort ${r.recovery_actions.map(a => esc(a.victim)).join(', ')} and release its leases.` : '<b>No deadlock.</b> The wait-for graph is acyclic.'} <span class="muted small">(${esc(r.analysis_time_ms.toFixed(3))} ms)</span></div></div>`));
    },

    b() {
      body.innerHTML = `
        <div class="grid cols-2">
          <div class="card"><div class="card-head"><h3>Graph & cache</h3>${window.components.teamTag('B', 'B1/B3')}</div><div id="b-metrics">${window.components.skeleton(1)}</div>
            ${isAdmin ? '<div class="row" style="margin-top:1rem;"><button class="btn btn-secondary btn-sm" id="b-inval">Invalidate ranking cache</button></div>' : ''}</div>
          <div class="card"><div class="card-head"><h3>Shortlist index lookup</h3>${window.components.teamTag('B', 'AVL vs hash')}</div>
            <div class="row"><input id="sl-key" class="form-control" style="flex:1;" placeholder="DRV001:STU001"/><select id="sl-via" class="form-control" style="width:auto;"><option value="avl">AVL tree</option><option value="hash">Hash index</option></select><button class="btn btn-secondary btn-sm" id="sl-go">Lookup</button></div><div id="sl-out" style="margin-top:.75rem;"></div></div>
        </div>
        ${isAdmin ? `<div class="card" style="margin-top:1.25rem;"><div class="card-head"><h3>Benchmark: ranking, index, graph, cache</h3>${window.components.teamTag('B', 'KPI evidence')}<button class="btn btn-primary btn-sm" id="b-bench">Run benchmark</button></div><div id="b-bench-out"><p class="sub">1,000 students / 5,000 edges: p95 ranking latency per algorithm, score deviation vs reference, AVL vs hash lookup, adjacency list vs matrix, repeated-ranking cache hit rate.</p></div></div>` : ''}`;
      const m = svc.team_b?.metrics;
      out('b-metrics', m ? `<dl class="kv small"><dt>Graph version</dt><dd>${esc(m.graph_version)}</dd><dt>Vertices / edges</dt><dd>${esc(m.graph?.vertices)} / ${esc(m.graph?.edges)}</dd><dt>Rankings computed</dt><dd>${esc(m.computations)}</dd><dt>p95 latency</dt><dd>${esc(m.p95_ranking_latency_ms)} ms</dd><dt>Cache</dt><dd>${esc(m.cache?.entries)} entries · hit rate ${esc(m.cache_hit_rate_pct)}%</dd><dt>AVL / hash entries</dt><dd>${esc(m.index?.avl?.entries)} / ${esc(m.index?.hash?.entries)}</dd></dl>` : '<p class="sub">Ranking engine metrics unavailable.</p>');
      document.getElementById('b-inval')?.addEventListener('click', (e) => window.components.runAction(e.currentTarget, () => window.api.invalidateRankingCache(), { success: (r) => `Invalidated ${r.invalidated} cached rankings in ${r.took_ms.toFixed(2)} ms` }));
      document.getElementById('sl-go').addEventListener('click', (e) => run(e.currentTarget, 'sl-out', () => window.api.shortlistLookup(document.getElementById('sl-key').value.trim(), document.getElementById('sl-via').value), (r) => `<div class="alert ok"><div>Rank <b>${esc(r.rank)}</b> · score ${esc(fmt.num(r.entry.total_score, 3))} · ${esc(r.via.toUpperCase())} lookup in <b>${esc(r.lookup_time_us)} µs</b> · graph ${esc(r.entry.graph_version)}${r.stale ? ' <span class="chip amber">stale</span>' : ''}</div></div>`).then(() => null).catch(() => null));
      document.getElementById('b-bench')?.addEventListener('click', (e) => run(e.currentTarget, 'b-bench-out', () => window.api.runBenchmark('team-b', { students: 1000, edges: 5000 }), (r) => `
        ${table(r.ranking.algorithms, [['Algorithm', x => `<b>${esc(x.algorithm.replace(/_/g, ' '))}</b>`], ['Candidates', x => esc(x.candidates)], ['p50', x => `${esc(x.p50_ms)} ms`], ['p95', x => `${esc(x.p95_ms)} ms <span class="chip ${x.p95_ms <= 100 ? 'green' : 'rose'}">${x.p95_ms <= 100 ? '≤100 ms' : 'slow'}</span>`], ['Score deviation', x => esc(r.ranking.score_deviation_from_reference[x.algorithm])]])}
        <dl class="kv" style="margin-top:1rem;"><dt>Index lookup p95</dt><dd>AVL ${esc(r.index_lookup.avl.p95_us)} µs · hash ${esc(r.index_lookup.hash.p95_us)} µs · memory ${esc(r.index_lookup.memory.avl_bytes)} B vs ${esc(r.index_lookup.memory.hash_bytes)} B</dd>
        <dt>Graph list vs matrix</dt><dd>list ${esc(r.graph_list_vs_matrix.LIST.memory_bytes_estimate)} B / ${esc(r.graph_list_vs_matrix.LIST.edge_lookup_total_ms)} ms · matrix ${esc(r.graph_list_vs_matrix.MATRIX.memory_bytes_estimate)} B / ${esc(r.graph_list_vs_matrix.MATRIX.edge_lookup_total_ms)} ms · results ${r.graph_list_vs_matrix.checksums_match ? 'identical' : 'DIFFER'}</dd>
        <dt>Cache</dt><dd>hit rate <b>${esc(r.cache.hit_rate_pct)}%</b> <span class="chip ${r.cache.hit_rate_pct >= 80 ? 'green' : 'rose'}">target ≥ 80%</span> · invalidation ${esc(r.cache.invalidation_ms)} ms</dd></dl>`));
    },

    c() {
      body.innerHTML = `
        <div class="grid cols-2">
          <div class="card"><div class="card-head"><h3>Reconciliation</h3>${window.components.teamTag('C', 'integrity')}<button class="btn btn-secondary btn-sm" id="rec-run">Run check</button></div><div id="rec-out"><p class="sub">Verifies seat counters against selected applications and that every evaluated application has a decision record.</p></div></div>
          ${isAdmin ? `<div class="card"><div class="card-head"><h3>Recovery (RPO ≤ 5 min · RTO ≤ 30 min)</h3>${window.components.teamTag('C', 'WAL & backups')}</div>
            <div class="row"><button class="btn btn-secondary btn-sm" id="wal-run">Verify WAL replay</button><button class="btn btn-primary btn-sm" id="bk-run">Create backup</button><button class="btn btn-success btn-sm" id="rs-run">Verify restore</button></div><div id="rec2-out" style="margin-top:.8rem;"></div></div>` : ''}
        </div>`;
      document.getElementById('rec-run').addEventListener('click', (e) => run(e.currentTarget, 'rec-out', () => window.api.getReconciliation(), (r) => `<div class="alert ${r.consistent ? 'ok' : 'error'}"><div><b>${r.consistent ? 'Consistent' : 'Inconsistent'}</b> — ${esc(r.checked_applications)} applications checked.${(r.applications_missing_decision || []).length ? ` Missing decisions: ${esc(r.applications_missing_decision.join(', '))}.` : ''}</div></div>${table(r.seat_reconciliation, [['Drive', x => `<span class="mono small">${esc(x.drive_id)}</span>`], ['Total', x => esc(x.seats_total)], ['Held', x => esc(x.held)], ['Remaining', x => esc(x.seats_remaining)], ['OK', x => (x.consistent ? '✓' : '✗')]])}`));
      document.getElementById('wal-run')?.addEventListener('click', (e) => run(e.currentTarget, 'rec2-out', () => window.api.recoveryVerify(), (r) => `<div class="alert ok"><div>WAL replay <b>${esc(r.status)}</b> · ${esc(r.replayed_transactions)} transactions · ${esc(r.recovery_time_ms)} ms</div></div>`));
      document.getElementById('bk-run')?.addEventListener('click', (e) => run(e.currentTarget, 'rec2-out', () => window.api.recoveryBackup(), (r) => `<div class="alert ok"><div>Backup <span class="mono">${esc(r.backup_id)}</span> created · ${esc(r.tables_copied)} tables in ${esc(r.took_ms)} ms</div></div>`));
      document.getElementById('rs-run')?.addEventListener('click', (e) => run(e.currentTarget, 'rec2-out', () => window.api.recoveryVerifyRestore(), (r) => r.status !== 'SUCCESS' ? `<div class="alert warn"><div>${esc(r.message || r.status)}</div></div>` : `<div class="alert ${r.tables_with_drift ? 'warn' : 'ok'}"><div><b>Restore verified</b> from <span class="mono">${esc(r.backup_id)}</span> · RTO ${esc(r.rto_seconds)} s <span class="chip green">${r.rto_met ? '≤ 30 min' : 'missed'}</span> · backup age ${esc(r.rpo_seconds)} s · ${esc(r.tables_with_drift)} table(s) differ from live (expected if data changed since the backup)</div></div>${table(r.reconciliation, [['Table', x => `<span class="mono small">${esc(x.table)}</span>`], ['Backup rows', x => esc(x.restored_rows)], ['Live rows', x => esc(x.live_rows)], ['Identical', x => (x.identical ? '✓' : 'changed since')]])}`));
    },
  };

  const show = (id) => { window.__sysTab = id; panels[id](); c.querySelectorAll('.tab').forEach(t => { const on = t.dataset.tab === id; t.classList.toggle('active', on); t.setAttribute('aria-selected', String(on)); }); };
  c.querySelectorAll('[data-tab]').forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
  document.getElementById('sys-refresh').addEventListener('click', () => window.views.admin.renderSystem());
  show(tab);
};
