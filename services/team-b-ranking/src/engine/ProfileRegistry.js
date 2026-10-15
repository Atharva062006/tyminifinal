// Team B — Skill/requirement graph and versioned profile registry (B1).
// Students and drives are vertices; both connect to skill vertices with weighted edges.
const AdjacencyList = require('../graph/AdjacencyList');
const AdjacencyMatrix = require('../graph/AdjacencyMatrix');
const Trie = require('../index/Trie');

const sv = id => `S:${id}`;
const dv = id => `D:${id}`;
const kv = name => `K:${String(name).toLowerCase()}`;

function normaliseSkills(list, defaultWeight = 1) {
  return (Array.isArray(list) ? list : []).map(s => {
    if (typeof s === 'string') return { name: s, level: defaultWeight, weight: defaultWeight };
    const level = s.level ?? s.weight ?? defaultWeight;
    return { name: String(s.name), level, weight: s.weight ?? level };
  }).filter(s => s.name && s.name !== 'undefined');
}

class ProfileRegistry {
  constructor({ graphImpl = 'LIST' } = {}) {
    this.graphImpl = graphImpl;
    this.graph = graphImpl === 'MATRIX' ? new AdjacencyMatrix() : new AdjacencyList();
    this.students = new Map();
    this.drives = new Map();
    this.skillTrie = new Trie();
    this.revision = 1;
    this.changeLog = []; // [{revision, kind, id, at}]
  }

  graphVersion() { return `g${this.revision}`; }

  _bump(kind, id) {
    this.revision++;
    this.changeLog.push({ revision: this.revision, kind, id, at: new Date().toISOString() });
    if (this.changeLog.length > 200) this.changeLog.shift();
  }

  _ensure(vertexId, data) {
    if (this.graph instanceof AdjacencyMatrix) this.graph.addVertex(vertexId, data);
    else if (!this.graph.hasVertex(vertexId)) this.graph.addVertex(vertexId, data);
  }

  validateStudent(p) {
    const errors = [];
    if (!p || !p.student_id) errors.push({ field: 'student_id', message: 'student_id is required' });
    if (!p || typeof p.cgpa !== 'number' || p.cgpa < 0 || p.cgpa > 10) errors.push({ field: 'cgpa', message: 'cgpa must be a number between 0 and 10' });
    if (p && p.backlogs != null && (typeof p.backlogs !== 'number' || p.backlogs < 0)) errors.push({ field: 'backlogs', message: 'backlogs must be >= 0' });
    if (p && p.attendance != null && (typeof p.attendance !== 'number' || p.attendance < 0 || p.attendance > 100)) errors.push({ field: 'attendance', message: 'attendance must be 0-100' });
    if (p && p.skills != null && !Array.isArray(p.skills)) errors.push({ field: 'skills', message: 'skills must be an array' });
    return errors;
  }

  upsertStudent(p) {
    const errors = this.validateStudent(p || {});
    if (errors.length) return { accepted: false, changed: false, errors, graph_version: this.graphVersion() };

    const profile = {
      student_id: p.student_id,
      name: p.name || p.student_id,
      branch: p.branch || null,
      cgpa: p.cgpa,
      backlogs: p.backlogs ?? 0,
      attendance: p.attendance ?? 80,
      project_score: p.project_score ?? 0,
      skills: normaliseSkills(p.skills),
    };
    const prev = this.students.get(profile.student_id);
    if (prev && JSON.stringify(prev) === JSON.stringify(profile)) {
      return { accepted: true, changed: false, errors: [], graph_version: this.graphVersion() };
    }

    this.students.set(profile.student_id, profile);
    this._ensure(sv(profile.student_id), { type: 'student' });
    if (this.graph instanceof AdjacencyList) this.graph.clearEdges(sv(profile.student_id));
    for (const s of profile.skills) {
      this._ensure(kv(s.name), { type: 'skill' });
      this.graph.addEdge(sv(profile.student_id), kv(s.name), s.level);
      this.skillTrie.insert(s.name);
    }
    this._bump('student', profile.student_id);
    return { accepted: true, changed: true, errors: [], graph_version: this.graphVersion() };
  }

  upsertDrive(p) {
    const errors = [];
    if (!p || !p.drive_id) errors.push({ field: 'drive_id', message: 'drive_id is required' });
    const c = (p && p.criteria) || {};
    const required = normaliseSkills(p && (p.required_skills || c.required_skills));
    const profile = p && {
      drive_id: p.drive_id,
      title: p.title || p.drive_id,
      min_cutoff: p.min_cutoff ?? c.min_cgpa ?? 0,
      max_backlogs: p.max_backlogs ?? c.max_backlogs ?? null,
      branches: p.branches || c.branches || [],
      required_skills: required,
      seats: p.seats ?? null,
    };
    if (profile && (typeof profile.min_cutoff !== 'number' || profile.min_cutoff < 0 || profile.min_cutoff > 10)) {
      errors.push({ field: 'min_cutoff', message: 'min_cutoff must be between 0 and 10' });
    }
    if (errors.length) return { accepted: false, changed: false, errors, graph_version: this.graphVersion() };

    const prev = this.drives.get(profile.drive_id);
    if (prev && JSON.stringify(prev) === JSON.stringify(profile)) {
      return { accepted: true, changed: false, errors: [], graph_version: this.graphVersion() };
    }
    this.drives.set(profile.drive_id, profile);
    this._ensure(dv(profile.drive_id), { type: 'drive' });
    if (this.graph instanceof AdjacencyList) this.graph.clearEdges(dv(profile.drive_id));
    for (const s of profile.required_skills) {
      this._ensure(kv(s.name), { type: 'skill' });
      this.graph.addEdge(dv(profile.drive_id), kv(s.name), s.weight);
    }
    this._bump('drive', profile.drive_id);
    return { accepted: true, changed: true, errors: [], graph_version: this.graphVersion() };
  }

  getStudent(id) { return this.students.get(id) || null; }
  getDrive(id) { return this.drives.get(id) || null; }

  /** Weighted skill coverage of a student against a drive: sum(req.weight * edge) / sum(req.weight). */
  skillMatch(studentId, drive) {
    if (!drive.required_skills.length) return { score: 1, matched: [], missing: [] };
    let total = 0; let max = 0;
    const matched = []; const missing = [];
    for (const req of drive.required_skills) {
      max += req.weight;
      const w = this.graph.getWeight(sv(studentId), kv(req.name));
      if (w > 0) { matched.push(req.name); total += w * req.weight; } else missing.push(req.name);
    }
    return { score: max > 0 ? Math.min(total / max, 1) : 0, matched, missing };
  }

  summary() {
    return {
      graph_version: this.graphVersion(),
      graph_impl: this.graphImpl,
      students: this.students.size,
      drives: this.drives.size,
      vertices: this.graph instanceof AdjacencyList ? this.graph.vertices.size : this.graph.vertices.length,
      edges: this.graph instanceof AdjacencyList ? this.graph.edgeCount() : null,
      skills: this.skillTrie.size,
      memory_bytes_estimate: this.graph.memoryBytes(),
    };
  }
}

module.exports = { ProfileRegistry, sv, dv, kv };
