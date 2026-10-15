// Team B — Ranking and shortlist computation (B2) + shortlist index (B3) + latency metrics.
const { v4: uuidv4 } = require('uuid');
const WeightedScore = require('../ranking/WeightedScore');
const HeapTopK = require('../ranking/HeapTopK');
const MergeSort = require('../ranking/MergeSort');
const { TIE_BREAK_RULE } = require('../ranking/compare');
const AVLTree = require('../index/AVLTree');
const HashIndex = require('../index/HashIndex');
const RankingCache = require('./RankingCache');
const { ValidationError, ConflictError, NotFoundError } = require('../../../../shared/errors');

const ALGORITHMS = { WEIGHTED_SCORE: new WeightedScore(), HEAP_TOPK: new HeapTopK(), MERGE_SORT: new MergeSort() };
const DEFAULT_WEIGHTS = { cgpa: 0.4, skills: 0.4, attendance: 0.2 };

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1))];
}

function validateWeights(w) {
  const weights = { ...DEFAULT_WEIGHTS, ...(w || {}) };
  const keys = ['cgpa', 'skills', 'attendance'];
  const errors = [];
  for (const k of keys) {
    if (typeof weights[k] !== 'number' || Number.isNaN(weights[k]) || weights[k] < 0) {
      errors.push({ field: `weights.${k}`, message: `${k} weight must be a non-negative number` });
    }
  }
  const sum = keys.reduce((a, k) => a + (Number(weights[k]) || 0), 0);
  if (!errors.length && Math.abs(sum - 1) > 0.01) {
    errors.push({ field: 'weights', message: `weights must sum to 1.0 (got ${sum.toFixed(3)})` });
  }
  if (errors.length) throw new ValidationError('Invalid weight vector', errors);
  return weights;
}

function hashIds(ids) {
  let h = 0x811c9dc5;
  for (const id of ids) for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${ids.length}-${h.toString(16)}`;
}

class RankingEngine {
  constructor(registry) {
    this.registry = registry;
    this.cache = new RankingCache();
    this.rankings = new Map();
    this.avl = new AVLTree();
    this.hash = new HashIndex();
    this.latencies = [];
    this.lookupUs = { avl: [], hash: [] };
    this.computeCount = 0;
    this.errors = 0;
  }

  _shortlistKey(driveId, studentId) { return `${driveId}:${studentId}`; }

  _scoreCandidates(drive, candidates, weights) {
    const qualified = [];
    const disqualified = [];
    for (const st of candidates) {
      const reasons = [];
      if (st.cgpa < drive.min_cutoff) reasons.push(`CGPA ${st.cgpa} below cutoff ${drive.min_cutoff}`);
      if (drive.max_backlogs != null && st.backlogs > drive.max_backlogs) reasons.push(`Backlogs ${st.backlogs} above limit ${drive.max_backlogs}`);
      if (drive.branches.length && st.branch && !drive.branches.includes(st.branch)) reasons.push(`Branch ${st.branch} not allowed`);
      if (reasons.length) { disqualified.push({ student_id: st.student_id, name: st.name, reasons }); continue; }

      const m = this.registry.skillMatch(st.student_id, drive);
      const cgpaC = (st.cgpa / 10) * weights.cgpa;
      const skillC = m.score * weights.skills;
      const attC = ((st.attendance ?? 80) / 100) * weights.attendance;
      const bonus = Math.min((st.project_score || 0) / 100, 1) * 0.05;
      const total = Math.max(0, cgpaC + skillC + attC + bonus - Math.min(st.backlogs * 0.02, 0.1));
      qualified.push({
        student_id: st.student_id,
        name: st.name,
        branch: st.branch,
        cgpa: st.cgpa,
        attendance: st.attendance,
        skills: st.skills.map(s => s.name),
        total_score: Number(total.toFixed(6)),
        skill_match_pct: Math.round(m.score * 100),
        matched_skills: m.matched,
        missing_skills: m.missing,
        score_breakdown: {
          cgpa_component: Number(cgpaC.toFixed(4)),
          skills_component: Number(skillC.toFixed(4)),
          attendance_component: Number(attC.toFixed(4)),
          project_bonus: Number(bonus.toFixed(4)),
        },
        tie_break_priority: st.student_id,
      });
    }
    return { qualified, disqualified };
  }

  /**
   * Compute (or serve from cache) a ranking.
   * @param {object} req  { drive_id, drive?, candidates?, candidate_ids?, algorithm, weights, k, graph_version }
   */
  compute(req, { bypassCache = false } = {}) {
    const t0 = process.hrtime.bigint();
    const algorithm = String(req.algorithm || 'WEIGHTED_SCORE').toUpperCase();
    if (!ALGORITHMS[algorithm]) throw new ValidationError(`Unsupported algorithm '${algorithm}'`, [{ field: 'algorithm', message: `Use one of ${Object.keys(ALGORITHMS).join(', ')}` }]);
    const weights = validateWeights(req.weights);

    // Upsert inline profiles so Team C / D may ship their own snapshot with the request.
    if (req.drive) this.registry.upsertDrive({ ...req.drive, drive_id: req.drive.drive_id || req.drive_id });
    for (const c of req.candidates || []) this.registry.upsertStudent(c);

    const drive = this.registry.getDrive(req.drive_id);
    if (!drive) throw new NotFoundError('Drive profile', req.drive_id);

    const currentVersion = this.registry.graphVersion();
    if (req.graph_version && req.graph_version !== currentVersion) {
      throw new ConflictError(`Stale graph_version '${req.graph_version}' (current: ${currentVersion})`, [{ current: currentVersion }]);
    }

    const ids = (req.candidate_ids && req.candidate_ids.length ? req.candidate_ids : (req.candidates || []).map(c => c.student_id));
    const pool = (ids.length ? ids : [...this.registry.students.keys()]).sort();
    const profiles = pool.map(id => this.registry.getStudent(id)).filter(Boolean);
    const missing = pool.filter(id => !this.registry.getStudent(id));

    const k = Number.isInteger(req.k) && req.k > 0 ? req.k : profiles.length;
    const key = [req.drive_id, algorithm, k, weights.cgpa, weights.skills, weights.attendance, currentVersion, hashIds(pool)].join('|');

    let cacheHit = false;
    let result = !bypassCache ? this.cache.get(key) : null;
    if (result) {
      cacheHit = true;
    } else {
      const { qualified, disqualified } = this._scoreCandidates(drive, profiles, weights);
      const ordered = ALGORITHMS[algorithm].rank(qualified, k);
      const rankingId = `RNK-${uuidv4().substring(0, 8)}`;
      result = {
        ranking_id: rankingId,
        drive_id: req.drive_id,
        algorithm,
        graph_version: currentVersion,
        weights,
        tie_break_rule: TIE_BREAK_RULE,
        total_candidates: profiles.length,
        explored_candidate_count: profiles.length,
        qualified_count: qualified.length,
        ordered_candidates: ordered,
        disqualified,
        unknown_candidates: missing,
        no_candidate_result: ordered.length === 0,
        generated_at: new Date().toISOString(),
      };
      this.rankings.set(rankingId, result);
      if (this.rankings.size > 500) this.rankings.delete(this.rankings.keys().next().value);
      this.cache.set(key, result, req.drive_id);
      this._indexShortlist(result);
    }

    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    this._record(ms);
    return { ...result, cache_hit: cacheHit, computation_time_ms: Number(ms.toFixed(3)) };
  }

  _indexShortlist(result) {
    this.avl.deletePrefix(`${result.drive_id}:`);
    this.hash.deletePrefix(`${result.drive_id}:`);
    for (const c of result.ordered_candidates) {
      const entry = { drive_id: result.drive_id, student_id: c.student_id, rank: c.rank, total_score: c.total_score, ranking_id: result.ranking_id, graph_version: result.graph_version };
      const key = this._shortlistKey(result.drive_id, c.student_id);
      this.avl.insert(key, entry);
      this.hash.set(key, entry);
    }
  }

  _record(ms) {
    this.computeCount++;
    this.latencies.push(ms);
    if (this.latencies.length > 2000) this.latencies.shift();
  }

  getRanking(id) {
    const r = this.rankings.get(id);
    if (!r) throw new NotFoundError('Ranking', id);
    return { ...r, stale: r.graph_version !== this.registry.graphVersion(), current_graph_version: this.registry.graphVersion() };
  }

  /** Shortlist-index lookup through either structure, timing each lookup in microseconds. */
  lookup(key, via = 'hash') {
    const structure = via === 'avl' ? this.avl : this.hash;
    const t0 = process.hrtime.bigint();
    const entry = structure.get(key);
    const us = Number(process.hrtime.bigint() - t0) / 1000;
    const bucket = this.lookupUs[via === 'avl' ? 'avl' : 'hash'];
    bucket.push(us);
    if (bucket.length > 2000) bucket.shift();
    const stale = entry ? entry.graph_version !== this.registry.graphVersion() : false;
    return { key, via: via === 'avl' ? 'avl' : 'hash', found: Boolean(entry), cache_hit: Boolean(entry) && !stale, stale, lookup_time_us: Number(us.toFixed(3)), entry: entry || null, rank: entry ? entry.rank : null };
  }

  invalidate(scope = {}) {
    const out = this.cache.invalidate(scope);
    if (scope.drive_id) {
      this.avl.deletePrefix(`${scope.drive_id}:`);
      this.hash.deletePrefix(`${scope.drive_id}:`);
    } else {
      this.avl.clear();
      this.hash.clear();
    }
    return out;
  }

  indexStats() {
    const stat = (arr) => { const s = [...arr].sort((a, b) => a - b); return { lookups: s.length, p95_us: Number(percentile(s, 95).toFixed(3)), avg_us: s.length ? Number((s.reduce((a, b) => a + b, 0) / s.length).toFixed(3)) : 0 }; };
    return {
      avl: { entries: this.avl.size, height: this.avl.height(), memory_bytes_estimate: this.avl.memoryBytes(), ...stat(this.lookupUs.avl) },
      hash: { entries: this.hash.size, load_factor: this.hash.loadFactor(), memory_bytes_estimate: this.hash.memoryBytes(), ...stat(this.lookupUs.hash) },
    };
  }

  metrics() {
    const s = [...this.latencies].sort((a, b) => a - b);
    return {
      computations: this.computeCount,
      p50_ranking_latency_ms: Number(percentile(s, 50).toFixed(3)),
      p95_ranking_latency_ms: Number(percentile(s, 95).toFixed(3)),
      p99_ranking_latency_ms: Number(percentile(s, 99).toFixed(3)),
      cache: this.cache.stats(),
      cache_hit_rate_pct: this.cache.stats().hit_rate_pct,
      graph: this.registry.summary(),
      graph_version: this.registry.graphVersion(),
      index: this.indexStats(),
      supported_algorithms: Object.keys(ALGORITHMS),
      stored_rankings: this.rankings.size,
    };
  }
}

module.exports = { RankingEngine, ALGORITHMS, validateWeights, DEFAULT_WEIGHTS, percentile };
