/**
 * Application Aggregation Service for Team D BFF.
 * Combines Team C authoritative state with Team A eligibility evaluation and Team B ranking details.
 */
const teamC = require('./teamCClient');
const teamA = require('./teamAClient');
const teamB = require('./teamBClient');
const { APPLICATION_STATES } = require('../../../../../shared/constants');

class ApplicationService {
  /**
   * Get enriched application by ID with traceability and timeline progression.
   */
  async getApplicationDetails(applicationId, correlationId) {
    const app = await teamC.getApplication(applicationId, correlationId);
    if (!app) return null;

    const [drive, student, queueInfo] = await Promise.all([
      teamC.getDrive(app.drive_id, correlationId).catch(() => null),
      teamC.getStudent(app.student_id, correlationId).catch(() => null),
      teamA.getDriveQueue(app.drive_id, correlationId).catch(() => null)
    ]);

    let company = null;
    if (drive?.company_id) {
      company = await teamC.getCompany(drive.company_id, correlationId).catch(() => null);
    }

    // Try to get ranking if drive has candidates ranked
    let rankingInfo = null;
    try {
      const driveRankings = await teamB.getRanking(app.drive_id, correlationId);
      if (driveRankings?.ordered_candidates) {
        rankingInfo = driveRankings.ordered_candidates.find(c => c.student_id === app.student_id);
      }
    } catch {
      // Degraded ranking lookup
      rankingInfo = null;
    }

    // Determine timeline progression
    const timeline = this._buildTimeline(app.state, app.created_at, app.updated_at);

    return {
      application: app,
      student: student || { student_id: app.student_id },
      drive: drive ? {
        ...drive,
        criteria: drive.criteria_json ? JSON.parse(drive.criteria_json) : {},
        company: company
      } : null,
      timeline,
      queue_status: queueInfo,
      ranking: rankingInfo,
      traceability: {
        application_id: app.application_id,
        student_id: app.student_id,
        drive_id: app.drive_id,
        version: app.version,
        idempotency_key: app.idempotency_key,
        correlation_id: correlationId
      }
    };
  }

  /**
   * Helper to construct state machine timeline progression
   */
  _buildTimeline(currentState, createdAt, updatedAt) {
    const steps = [
      { key: APPLICATION_STATES.APPLIED, label: 'Applied', desc: 'Application submitted with student consent' },
      { key: APPLICATION_STATES.SCREENING, label: 'Screening', desc: 'Document verification & criteria check' },
      { key: APPLICATION_STATES.RULE_EVALUATED, label: 'Rule Evaluated', desc: 'Eligibility rules evaluated by OS Engine' },
      { key: APPLICATION_STATES.SHORTLISTED, label: 'Shortlisted', desc: 'Candidate scored & shortlisted by DS Engine' },
      { key: APPLICATION_STATES.INTERVIEW_SCHEDULED, label: 'Interview Scheduled', desc: 'Interview slot allocated and reserved' },
      { key: APPLICATION_STATES.SELECTED, label: 'Selected', desc: 'Candidate selected by hiring company' },
      { key: APPLICATION_STATES.OFFER_ISSUED, label: 'Offer Issued', desc: 'Official placement offer committed' }
    ];

    const alternativeStates = ['NOT_ELIGIBLE', 'WAITLISTED', 'WITHDRAWN', 'EXPIRED', 'COMPENSATION_REQUIRED'];
    const isAlternative = alternativeStates.includes(currentState);

    const stepOrder = steps.map(s => s.key);
    const currentIndex = stepOrder.indexOf(currentState);

    return steps.map((step, idx) => {
      let status = 'UPCOMING';
      if (!isAlternative) {
        if (idx < currentIndex) status = 'COMPLETED';
        else if (idx === currentIndex) status = 'CURRENT';
        else status = 'UPCOMING';
      } else {
        // In alternative outcome
        if (currentState === 'WITHDRAWN') {
          status = idx === 0 ? 'COMPLETED' : 'CANCELLED';
        } else if (currentState === 'NOT_ELIGIBLE') {
          if (idx <= 2) status = idx === 2 ? 'FAILED' : 'COMPLETED';
          else status = 'CANCELLED';
        } else if (currentState === 'WAITLISTED') {
          if (idx <= 3) status = idx === 3 ? 'WAITLISTED' : 'COMPLETED';
          else status = 'UPCOMING';
        } else {
          status = 'CANCELLED';
        }
      }

      return {
        ...step,
        status,
        timestamp: (status === 'CURRENT' || status === 'COMPLETED') ? (updatedAt || createdAt) : null
      };
    });
  }
}

module.exports = new ApplicationService();
