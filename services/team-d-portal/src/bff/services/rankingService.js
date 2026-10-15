/**
 * Ranking Service for Team D BFF.
 * Orchestrates candidate pool extraction from Team C and ranking execution via Team B.
 */
const teamB = require('./teamBClient');
const teamC = require('./teamCClient');

const ACTIVE = ['RULE_EVALUATED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER_ISSUED', 'OFFER_ACCEPTED', 'WAITLISTED'];

class RankingService {
  /**
   * Get or compute candidate rankings for a specific drive.
   * Pool = applicants that passed eligibility; when nobody has applied yet the whole student body is ranked
   * as a clearly-labelled preview (pool = 'ALL_STUDENTS').
   */
  async getDriveRankings(driveId, options = {}, correlationId, actor) {
    const { algorithm = 'WEIGHTED_SCORE', weights = { cgpa: 0.4, skills: 0.4, attendance: 0.2 }, k } = options;

    const [drive, driveApps, allStudents] = await Promise.all([
      teamC.getDrive(driveId, correlationId).catch(() => null),
      teamC.listApplications({ drive_id: driveId }, correlationId, actor).catch(() => []),
      teamC.listStudents(correlationId).catch(() => []),
    ]);
    const studentMap = new Map(allStudents.map(s => [s.student_id, s]));
    const appByStudent = new Map(driveApps.map(a => [a.student_id, a]));

    let pool = 'APPLICANTS';
    let source = driveApps.filter(a => ACTIVE.includes(a.state)).map(a => studentMap.get(a.student_id) || { student_id: a.student_id });
    if (source.length === 0) {
      pool = 'ALL_STUDENTS';
      source = allStudents;
    }

    const candidates = source.map(s => ({
      student_id: s.student_id, name: s.name || s.student_id, branch: s.branch, cgpa: s.cgpa ?? 7.5,
      backlogs: s.backlogs || 0, attendance: s.attendance ?? 80, skills: s.skills || [],
      project_score: Math.min((s.projects || []).length * 20 + (s.certifications || []).length * 10, 100),
    }));

    let criteria = {};
    try { criteria = drive?.criteria_json ? JSON.parse(drive.criteria_json) : {}; } catch { /* ignore */ }

    const base = { drive_id: driveId, drive_title: drive?.title || 'Drive Ranking', seats: drive?.seats_total || drive?.seats || 10, pool, candidates_count: candidates.length };

    try {
      const result = await teamB.computeRanking({
        drive_id: driveId,
        drive: { drive_id: driveId, title: drive?.title, criteria, seats: drive?.seats_total || drive?.seats },
        candidates, algorithm, weights, k,
      }, correlationId);

      const decorate = (c) => {
        const app = appByStudent.get(c.student_id);
        return { ...c, application_id: app?.application_id || null, application_state: app?.state || 'NOT_APPLIED' };
      };
      return {
        ...base,
        algorithm: result.algorithm || algorithm,
        graph_version: result.graph_version,
        ranking_id: result.ranking_id,
        weights: result.weights || weights,
        tie_break_rule: result.tie_break_rule,
        explored_candidate_count: result.explored_candidate_count ?? candidates.length,
        rankings: (result.ordered_candidates || []).map(decorate),
        disqualified: result.disqualified || [],
        cache_hit: Boolean(result.cache_hit),
        degraded: Boolean(result.degraded),
        computation_time_ms: result.computation_time_ms,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.warn(`[Ranking Service] Team B unavailable (${err.message}). Returning degraded state.`);
      return {
        ...base,
        algorithm,
        graph_version: 'unknown',
        rankings: candidates.map((c, i) => ({ ...c, rank: i + 1, total_score: null, application_id: appByStudent.get(c.student_id)?.application_id || null, application_state: appByStudent.get(c.student_id)?.state || 'NOT_APPLIED' })),
        disqualified: [],
        degraded: true,
        degraded_message: 'Ranking engine temporarily unavailable. The applications remain valid.',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

module.exports = new RankingService();
