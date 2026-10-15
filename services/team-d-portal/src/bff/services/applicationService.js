/**
 * Application Aggregation Service for Team D BFF.
 * Combines Team C authoritative state (application, decisions, interviews, offers, audit trail) with
 * Team A queue detail and Team B ranking details into one view for the UI.
 */
const teamC = require('./teamCClient');
const teamA = require('./teamAClient');
const teamB = require('./teamBClient');

const MAIN_PATH = [
  { key: 'APPLIED', label: 'Applied', desc: 'Application submitted with student consent' },
  { key: 'SCREENING', label: 'Screening', desc: 'Request queued with the eligibility engine (Team A)' },
  { key: 'RULE_EVALUATED', label: 'Rule Evaluated', desc: 'Eligibility rules evaluated and applicant ranked (Teams A + B)' },
  { key: 'SHORTLISTED', label: 'Shortlisted', desc: 'Shortlisted by the placement cell' },
  { key: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled', desc: 'Interview slot reserved (Team A slot lease)' },
  { key: 'SELECTED', label: 'Selected', desc: 'Selected by the hiring company — seat claimed' },
  { key: 'OFFER_ISSUED', label: 'Offer Issued', desc: 'Official placement offer committed' },
  { key: 'OFFER_ACCEPTED', label: 'Offer Accepted', desc: 'Student accepted the offer — placement complete' },
];
const ALTERNATIVE = {
  NOT_ELIGIBLE: { failAt: 'RULE_EVALUATED', label: 'Not Eligible' },
  REJECTED: { label: 'Rejected' },
  WITHDRAWN: { label: 'Withdrawn' },
  WAITLISTED: { failAt: 'SHORTLISTED', label: 'Waitlisted' },
  OFFER_DECLINED: { label: 'Offer Declined' },
  EXPIRED: { label: 'Expired' },
  COMPENSATION_REQUIRED: { label: 'Compensation Required' },
};

class ApplicationService {
  async getApplicationDetails(applicationId, correlationId, actor) {
    const details = await teamC.getApplicationDetails(applicationId, correlationId, actor);
    if (!details) return null;
    const app = details.application;

    const [drive, student, queueInfo] = await Promise.all([
      teamC.getDrive(app.drive_id, correlationId).catch(() => null),
      teamC.getStudent(app.student_id, correlationId).catch(() => null),
      teamA.getDriveQueue(app.drive_id, correlationId).catch(() => null),
    ]);

    let company = null;
    if (drive?.company_id) company = await teamC.getCompany(drive.company_id, correlationId).catch(() => null);

    // Live ranking record from Team B (the application stores ranking_id / rank at evaluation time)
    let rankingInfo = null;
    if (app.ranking_id) {
      try {
        const r = await teamB.getRanking(app.ranking_id, correlationId);
        const me = r?.ordered_candidates?.find(c => c.student_id === app.student_id);
        rankingInfo = {
          ranking_id: app.ranking_id,
          rank: me ? me.rank : app.rank,
          total_score: me ? me.total_score : app.rank_score,
          pool: r?.qualified_count ?? app.rank_pool,
          algorithm: r?.algorithm || 'WEIGHTED_SCORE',
          graph_version: r?.graph_version || app.graph_version,
          stale: Boolean(r?.stale),
          score_breakdown: me?.score_breakdown,
          matched_skills: me?.matched_skills,
          missing_skills: me?.missing_skills,
        };
      } catch {
        rankingInfo = { ranking_id: app.ranking_id, rank: app.rank, total_score: app.rank_score, pool: app.rank_pool, graph_version: app.graph_version };
      }
    } else if (app.rank) {
      rankingInfo = { rank: app.rank, total_score: app.rank_score, pool: app.rank_pool };
    }

    const timeline = this._buildTimeline(app, details.audit || []);

    return {
      application: app,
      student: student || { student_id: app.student_id },
      drive: drive ? {
        ...drive,
        criteria: drive.criteria_json ? JSON.parse(drive.criteria_json) : {},
        company,
      } : null,
      timeline,
      decisions: details.decisions || [],
      interviews: details.interviews || [],
      offers: details.offers || [],
      queue_status: queueInfo,
      ranking: rankingInfo,
      ranking_status: app.ranking_status || (rankingInfo ? 'OK' : 'PENDING'),
      pipeline_status: app.pipeline_status || null,
      traceability: {
        application_id: app.application_id,
        student_id: app.student_id,
        drive_id: app.drive_id,
        version: app.version,
        idempotency_key: app.idempotency_key,
        eligibility_request_id: app.eligibility_request_id || null,
        decision_id: app.decision_id || null,
        ranking_id: app.ranking_id || null,
        correlation_ids: [...new Set((details.audit || []).map(a => a.correlation_id).filter(Boolean))].slice(0, 12),
        correlation_id: correlationId,
      },
      audit_trail: details.audit || [],
    };
  }

  /** Build the stepper from real audit timestamps. */
  _buildTimeline(app, audit) {
    const reachedAt = new Map([['APPLIED', app.created_at]]);
    for (const a of audit) {
      const m = /^STATE_TRANSITION:\w+->(\w+)$/.exec(a.action || '');
      if (m && !reachedAt.has(m[1])) reachedAt.set(m[1], a.timestamp);
    }
    reachedAt.set(app.state, reachedAt.get(app.state) || app.updated_at);

    const alt = ALTERNATIVE[app.state];
    const currentIdx = MAIN_PATH.findIndex(s => s.key === app.state);
    const lastReachedIdx = Math.max(...MAIN_PATH.map((s, i) => (reachedAt.has(s.key) ? i : -1)));

    const steps = MAIN_PATH.map((step, idx) => {
      let status = 'UPCOMING';
      if (!alt) {
        status = idx < currentIdx ? 'COMPLETED' : idx === currentIdx ? 'CURRENT' : 'UPCOMING';
        if (app.state === 'OFFER_ACCEPTED' && idx === currentIdx) status = 'COMPLETED';
      } else if (idx <= lastReachedIdx) {
        status = 'COMPLETED';
        if (alt.failAt === step.key) status = app.state === 'NOT_ELIGIBLE' ? 'FAILED' : 'WAITLISTED';
      } else {
        status = 'CANCELLED';
      }
      if (alt && app.state === 'NOT_ELIGIBLE' && step.key === 'RULE_EVALUATED') status = 'FAILED';
      return { ...step, status, timestamp: reachedAt.get(step.key) || null };
    });

    return steps;
  }
}

module.exports = new ApplicationService();
