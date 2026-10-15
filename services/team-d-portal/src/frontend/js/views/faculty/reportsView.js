/**
 * Placement performance report (Team C aggregates + engine telemetry) with CSV / JSON export and print.
 */
window.views = window.views || {};
window.views.faculty = window.views.faculty || {};

window.views.faculty.renderReports = async function () {
  const c = document.getElementById('main-content');
  window.components.beginLoad(c);
  const f = window.__repF = window.__repF || { branch: '', drive_id: '' };
  const [res, drives, students] = await Promise.all([
    window.api.getPlacementReports({ branch: f.branch, drive_id: f.drive_id }),
    window.api.getDrives(),
    window.api.getStudents().catch(() => []),
  ]);
  const r = res.report || {};
  const t = r.totals || {};
  const branches = [...new Set(students.map(s => s.branch))].sort();
  const tel = res.telemetry || {};

  c.innerHTML = `
    ${window.components.pageHeader({
      title: 'Placement performance report', subtitle: `Generated ${fmt.dateTime(r.generated_at)}${r.query_time_ms !== undefined ? ` · query ${r.query_time_ms} ms (B-tree / hash indexed)` : ''}`,
      tags: [['C', 'indexed reporting queries'], ['B', 'telemetry'], ['A', 'telemetry']],
      actions: `<div class="row no-print">
        <button class="btn btn-secondary btn-sm" data-exp="placement_performance:csv">CSV summary</button>
        <button class="btn btn-secondary btn-sm" data-exp="branch_performance:csv">CSV by branch</button>
        <button class="btn btn-secondary btn-sm" data-exp="drive_performance:csv">CSV by drive</button>
        <button class="btn btn-secondary btn-sm" data-exp="placement_performance:json">JSON</button>
        <button class="btn btn-primary btn-sm" id="print-rep">Print / PDF</button></div>`,
    })}
    <div class="filter-bar no-print">
      <select id="rp-branch" class="form-control" aria-label="Branch"><option value="">All branches</option>${branches.map(b => `<option ${f.branch === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
      <select id="rp-drive" class="form-control" aria-label="Drive"><option value="">All drives</option>${drives.map(d => `<option value="${esc(d.drive_id)}" ${f.drive_id === d.drive_id ? 'selected' : ''}>${esc(d.title)}</option>`).join('')}</select>
    </div>
    <div class="kpi-grid">
      ${window.components.kpi({ label: 'Applications', value: t.total_applications })}
      ${window.components.kpi({ label: 'Selected', value: t.total_selected, tone: 'purple', meta: `conversion ${esc(t.overall_conversion || '0%')}` })}
      ${window.components.kpi({ label: 'Offers issued', value: t.total_offers_issued, tone: 'cyan' })}
      ${window.components.kpi({ label: 'Offers accepted', value: t.total_offers_accepted, tone: 'green' })}
      ${window.components.kpi({ label: 'Students placed', value: t.students_placed ?? '—', tone: 'amber', meta: t.total_students ? `of ${esc(t.total_students)}` : '' })}
    </div>
    <div class="card" style="margin-bottom:1.25rem;"><div class="card-head"><h3>Drive-wise</h3></div>
      ${window.components.renderDataTable({ columns: [
        { label: 'Drive', render: x => `<b>${esc(x.title)}</b><br><span class="muted small">${esc(x.drive_id)}</span>` }, { label: 'State', render: x => window.components.renderBadge(x.state) },
        { label: 'Seats', render: x => `${esc(x.seats_remaining)} / ${esc(x.seats_total)}` }, { label: 'Applied', render: x => esc(x.applications) }, { label: 'Shortlisted+', render: x => esc(x.shortlisted ?? '—') },
        { label: 'Selected', render: x => esc(x.selected) }, { label: 'Offers', render: x => `${esc(x.offers_issued)} (${esc(x.offers_accepted ?? 0)} accepted)` }, { label: 'Package', render: x => esc(fmt.money(x.package_lpa)) }, { label: 'Conversion', render: x => `<b>${esc(x.conversion_rate)}</b>` },
      ], rows: r.drive_stats || [], emptyMessage: 'No drives.' })}</div>
    <div class="grid cols-2" style="margin-bottom:1.25rem;">
      <div class="card"><div class="card-head"><h3>Branch-wise</h3></div>
        ${window.components.renderDataTable({ columns: [
          { label: 'Branch', render: x => `<b>${esc(x.branch)}</b>` }, { label: 'Students', render: x => esc(x.total_students) }, { label: 'Applications', render: x => esc(x.applications) }, { label: 'Placed', render: x => esc(x.placed_students ?? x.selected) }, { label: 'Placement rate', render: x => `<b>${esc(x.placement_rate || x.conversion_rate)}</b>` },
        ], rows: r.branch_stats || [], emptyMessage: 'No data.' })}</div>
      <div class="card"><div class="card-head"><h3>Package distribution</h3></div>
        ${r.package_distribution ? `<dl class="kv"><dt>Offers counted</dt><dd>${esc(r.package_distribution.count)}</dd><dt>Minimum</dt><dd>${esc(fmt.money(r.package_distribution.min_lpa))}</dd><dt>Average</dt><dd><b>${esc(fmt.money(r.package_distribution.avg_lpa))}</b></dd><dt>Maximum</dt><dd>${esc(fmt.money(r.package_distribution.max_lpa))}</dd></dl>` : '<p class="sub">No offers issued yet.</p>'}
      </div>
    </div>
    <div class="card"><div class="card-head"><h3>Engine telemetry snapshot</h3><span class="small muted">benchmark evidence lives under System &amp; Engines</span></div>
      <div class="grid cols-2"><dl class="kv small"><dt>${window.components.teamTag('A')}</dt><dd></dd><dt>p95 decision latency</dt><dd>${esc(tel.team_a_eligibility?.p95_decision_latency_ms ?? '—')} ms</dd><dt>Throughput</dt><dd>${esc(tel.team_a_eligibility?.throughput_per_sec ?? '—')} / s</dd><dt>Active leases</dt><dd>${esc(tel.team_a_eligibility?.active_leases ?? '—')}</dd></dl>
      <dl class="kv small"><dt>${window.components.teamTag('B')}</dt><dd></dd><dt>p95 ranking latency</dt><dd>${esc(tel.team_b_ranking?.p95_ranking_latency_ms ?? '—')} ms</dd><dt>Cache hit rate</dt><dd>${esc(tel.team_b_ranking?.cache_hit_rate_pct ?? '—')}%</dd><dt>Graph version</dt><dd>${esc(tel.team_b_ranking?.graph_version ?? '—')}</dd></dl></div>
    </div>`;

  const reload = () => window.views.faculty.renderReports();
  document.getElementById('rp-branch').addEventListener('change', e => { f.branch = e.target.value; reload(); });
  document.getElementById('rp-drive').addEventListener('change', e => { f.drive_id = e.target.value; reload(); });
  document.getElementById('print-rep').addEventListener('click', () => window.print());
  c.querySelectorAll('[data-exp]').forEach(b => b.addEventListener('click', async () => {
    const [type, format] = b.dataset.exp.split(':');
    await window.components.runAction(b, () => window.api.downloadReport(type, format, { branch: f.branch || 'ALL' }), { success: 'Export downloaded' });
  }));
};
