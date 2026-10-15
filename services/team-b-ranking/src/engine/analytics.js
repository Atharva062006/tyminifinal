// Team B — Performance-trend and cohort analysis (B4).
// Deterministic aggregation with a documented tie-break (value DESC, key ASC) and complexity evidence.
const MergeSort = require('../ranking/MergeSort');

const SELECTED = new Set(['SELECTED', 'OFFER_ISSUED', 'OFFER_ACCEPTED']);
const ms = new MergeSort();

function sortDesc(entries, valueKey) {
  const scored = entries.map(e => ({ student_id: String(e.key), total_score: e[valueKey], ...e }));
  return ms.rank(scored).map(({ student_id, total_score, rank, algorithm, ...rest }) => rest);
}

/** Hash-map aggregation: O(n) time, O(g) space. */
function hashAggregate(items, keyFn) {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return map;
}

/** Sort-then-scan aggregation: O(n log n) time, O(n) space (comparison baseline). */
function sortAggregate(items, keyFn) {
  const sorted = items.map(it => ({ it, k: String(keyFn(it)) })).sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  const map = new Map();
  for (const { it, k } of sorted) {
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return map;
}

function median(sortedNums) {
  if (!sortedNums.length) return 0;
  const m = sortedNums.length >> 1;
  return sortedNums.length % 2 ? sortedNums[m] : (sortedNums[m - 1] + sortedNums[m]) / 2;
}

function analyse(input = {}) {
  const t0 = process.hrtime.bigint();
  const algorithm = String(input.algorithm || 'HASH_AGG').toUpperCase();
  const reps = Math.max(1, Math.min(parseInt(input.repetitions || 1, 10), 100));
  const agg = algorithm === 'SORT_AGG' ? sortAggregate : hashAggregate;

  const students = input.students || [];
  const applications = input.applications || [];
  const drives = input.drives || [];
  const companies = input.companies || [];
  const branchFilter = input.department || input.branch || null;

  const studentById = new Map(students.map(s => [s.student_id, s]));
  const driveById = new Map(drives.map(d => [d.drive_id, d]));
  const companyById = new Map(companies.map(c => [c.company_id, c]));

  let apps = applications;
  if (branchFilter) apps = apps.filter(a => (studentById.get(a.student_id) || {}).branch === branchFilter);

  let byBranch; let byDrive;
  for (let i = 0; i < reps; i++) {
    byBranch = agg(apps, a => (studentById.get(a.student_id) || {}).branch || 'UNKNOWN');
    byDrive = agg(apps, a => a.drive_id);
  }

  const studentsPerBranch = hashAggregate(students, s => s.branch || 'UNKNOWN');
  const department_trend = sortDesc([...byBranch.entries()].map(([branch, list]) => {
    const placed = list.filter(a => SELECTED.has(a.state)).length;
    return {
      key: branch, branch,
      students: (studentsPerBranch.get(branch) || []).length,
      applications: list.length,
      placed,
      placement_rate_pct: list.length ? Number(((placed / list.length) * 100).toFixed(1)) : 0,
      value: placed,
    };
  }), 'value').map(({ key, value, ...r }) => r);

  const company_conversion = sortDesc([...byDrive.entries()].map(([driveId, list]) => {
    const d = driveById.get(driveId) || {};
    const c = companyById.get(d.company_id) || {};
    const placed = list.filter(a => SELECTED.has(a.state)).length;
    return {
      key: driveId, drive_id: driveId, company_name: c.name || d.title || driveId, title: d.title || driveId,
      applications: list.length, shortlisted: list.filter(a => !['APPLIED', 'SCREENING', 'RULE_EVALUATED', 'NOT_ELIGIBLE', 'WITHDRAWN', 'REJECTED'].includes(a.state)).length,
      placed,
      conversion_pct: list.length ? Number(((placed / list.length) * 100).toFixed(1)) : 0,
      value: list.length ? placed / list.length : 0,
    };
  }), 'value').map(({ key, value, ...r }) => r);

  const placedDrives = apps.filter(a => SELECTED.has(a.state)).map(a => (driveById.get(a.drive_id) || {}).package).filter(p => typeof p === 'number');
  const pkgs = ms.rank(placedDrives.map((p, i) => ({ student_id: String(i).padStart(8, '0'), total_score: p }))).map(x => x.total_score).reverse();
  const bucketSize = input.bucket_size || 300000;
  const hist = new Map();
  for (const p of pkgs) { const b = Math.floor(p / bucketSize) * bucketSize; hist.set(b, (hist.get(b) || 0) + 1); }
  const package_distribution = {
    count: pkgs.length,
    min: pkgs[0] || 0,
    max: pkgs[pkgs.length - 1] || 0,
    average: pkgs.length ? Math.round(pkgs.reduce((a, b) => a + b, 0) / pkgs.length) : 0,
    median: median(pkgs),
    histogram: [...hist.entries()].sort((a, b) => a[0] - b[0]).map(([from, count]) => ({ from, to: from + bucketSize, count })),
  };

  const skillDemand = new Map();
  for (const d of drives) for (const s of (d.criteria?.required_skills || (d.criteria_json ? safeParse(d.criteria_json).required_skills : []) || [])) {
    skillDemand.set(s, (skillDemand.get(s) || 0) + 1);
  }
  const skillSupply = new Map();
  for (const s of students) for (const sk of (s.skills || [])) skillSupply.set(sk, (skillSupply.get(sk) || 0) + 1);
  const skill_gap = sortDesc([...skillDemand.entries()].map(([skill, demand]) => ({ key: skill, skill, drives_requiring: demand, students_with_skill: skillSupply.get(skill) || 0, value: demand - (skillSupply.get(skill) || 0) })), 'value').map(({ key, value, ...r }) => r);

  const elapsed = Number(process.hrtime.bigint() - t0) / 1e6;
  const n = apps.length;
  return {
    department_trend,
    company_conversion,
    package_distribution,
    skill_gap,
    totals: { students: students.length, applications: n, drives: drives.length, placed: apps.filter(a => SELECTED.has(a.state)).length },
    complexity_evidence: {
      algorithm,
      input_size: n,
      repetitions: reps,
      elapsed_ms: Number(elapsed.toFixed(3)),
      per_repetition_ms: Number((elapsed / reps).toFixed(4)),
      time_complexity: algorithm === 'SORT_AGG' ? 'O(n log n)' : 'O(n)',
      space_complexity: algorithm === 'SORT_AGG' ? 'O(n)' : 'O(g) where g = number of groups',
      tie_break_rule: 'value DESC, then key ASC',
    },
    generated_at: new Date().toISOString(),
  };
}

function safeParse(s) { try { return JSON.parse(s) || {}; } catch { return {}; } }

module.exports = { analyse };
