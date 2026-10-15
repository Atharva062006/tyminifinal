/**
 * WorkflowService — Team C's orchestration of the placement lifecycle (C2 + C3).
 *
 *   Apply -> [Team A evaluate] -> [Team B rank] -> staff review -> interview (Team A slot lease)
 *         -> selection (seat claim) -> offer -> accept / decline
 *
 * Every state change is: authorised by role, checked against the state machine, committed in ONE
 * ACID transaction together with its side-effects (seat counters, offers, interviews, decisions),
 * then audited, notified and broadcast over SSE. If a Team A lease was granted and the commit
 * fails, the lease is released (compensation).
 */
const { v4: uuidv4 } = require('uuid');
const stateMachine = require('./stateMachineService');
const sseService = require('./sseService');
const { teamA, teamB } = require('./engineClients');
const { AppError, ConflictError, NotFoundError, ForbiddenError, ValidationError } = require('../../../../shared/errors');

const STAFF = ['faculty', 'admin'];
const SEAT_HOLDING = ['SELECTED', 'OFFER_ISSUED'];
const ACTIVE_FOR_RANKING = ['RULE_EVALUATED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER_ISSUED', 'OFFER_ACCEPTED', 'WAITLISTED'];

/** Which roles may drive which target state. `system` (service calls) may do anything. */
const PERMISSIONS = {
  SCREENING: ['system'],
  RULE_EVALUATED: ['system'],
  NOT_ELIGIBLE: ['system'],
  SHORTLISTED: [...STAFF, 'system'],
  WAITLISTED: [...STAFF, 'system'],
  REJECTED: [...STAFF, 'system'],
  INTERVIEW_SCHEDULED: [...STAFF, 'system'],
  SELECTED: [...STAFF, 'system'],
  OFFER_ISSUED: [...STAFF, 'system'],
  OFFER_ACCEPTED: ['student', 'system'],
  OFFER_DECLINED: ['student', 'system'],
  WITHDRAWN: ['student', ...STAFF, 'system'],
  EXPIRED: ['system', 'admin'],
  COMPENSATION_REQUIRED: ['system', 'admin'],
};

const STATE_COPY = {
  SHORTLISTED: { title: 'You have been shortlisted', msg: (d) => `You were shortlisted for ${d.title}. Watch for interview details.` },
  WAITLISTED: { title: 'Application waitlisted', msg: (d) => `Your application for ${d.title} has been placed on the waitlist.` },
  REJECTED: { title: 'Application not selected', msg: (d, reason) => `Your application for ${d.title} was not taken forward.${reason ? ' Reason: ' + reason : ''}` },
  SELECTED: { title: 'You have been selected', msg: (d) => `Congratulations! You were selected for ${d.title}. An offer letter will follow.` },
  OFFER_ISSUED: { title: 'Placement offer issued', msg: (d, _r, p) => `Offer for ${d.title}${p ? ` — ${p}` : ''}. Please accept or decline from the Offers page.` },
  NOT_ELIGIBLE: { title: 'Not eligible for this drive', msg: (d) => `You do not meet the eligibility criteria for ${d.title}.` },
  RULE_EVALUATED: { title: 'Eligibility check passed', msg: (d) => `You are eligible for ${d.title}. The placement cell will review your application.` },
};

class WorkflowService {
  constructor(db, auditService, notificationService) {
    this.db = db;
    this.audit = auditService;
    this.notify = notificationService;
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  _getApp(id) {
    const app = this.db.table('applications').findById(id);
    if (!app) throw new NotFoundError('Application', id);
    return app;
  }

  _drive(id) { return this.db.table('drives').findById(id); }

  _criteria(drive) {
    try { return drive?.criteria_json ? JSON.parse(drive.criteria_json) : {}; } catch { return {}; }
  }

  snapshot(student) {
    return {
      student_id: student.student_id, name: student.name, branch: student.branch, cgpa: student.cgpa,
      backlogs: student.backlogs || 0, attendance: student.attendance, skills: student.skills || [],
      project_score: Math.min((student.projects || []).length * 20 + (student.certifications || []).length * 10, 100),
    };
  }

  priorityFor(student) { return student.cgpa >= 9 ? 1 : student.cgpa >= 8 ? 3 : 5; }

  _authorise(app, target, actor) {
    const allowed = PERMISSIONS[target];
    if (!allowed) throw new ValidationError(`Unknown target state '${target}'`);
    if (!allowed.includes(actor.role)) {
      throw new ForbiddenError(`Role '${actor.role}' may not move an application to ${target}`);
    }
    if (actor.role === 'student' && actor.id !== app.student_id) {
      throw new ForbiddenError('Students may only act on their own applications');
    }
  }

  // ── generic atomic state change ──────────────────────────────────────────

  /**
   * Commit a state change with side-effects in one transaction.
   * @returns {{before, after, extras}}
   */
  async _commit(appId, target, { actor, correlationId, expectedVersion, updates = {}, tx } = {}) {
    let before;
    let extras = {};
    const after = await this.db.transactionIndexed(async (txn) => {
      const current = await txn.readForUpdate('applications', appId);
      if (!current) throw new NotFoundError('Application', appId);
      before = { ...current };
      if (expectedVersion != null && current.version !== Number(expectedVersion)) {
        throw new ConflictError(`Application version mismatch: expected ${expectedVersion}, got ${current.version}`);
      }
      stateMachine.assertValidTransition(current.state, target);

      // Seat accounting: leaving a seat-holding state frees the seat (except into acceptance)
      const holds = SEAT_HOLDING.includes(current.state);
      const keepsSeat = SEAT_HOLDING.includes(target) || target === 'OFFER_ACCEPTED';
      if (holds && !keepsSeat) {
        const drive = await txn.readForUpdate('drives', current.drive_id);
        await txn.update('drives', current.drive_id, { seats: drive.seats + 1, version: (drive.version || 1) + 1, updated_at: new Date().toISOString() });
        if (target !== 'OFFER_DECLINED') { // a decline marks the offer DECLINED itself (see tx below)
          for (const o of this.db.lookupBy('offers', 'application_id', appId).filter(x => ['PENDING', 'COMMITTED'].includes(x.status))) {
            await txn.update('offers', o.offer_id, { status: 'COMPENSATED' });
          }
        }
        extras.seat_released = true;
      }

      // Interview housekeeping when the process ends or the candidate is selected
      if (['SELECTED', 'REJECTED', 'WITHDRAWN', 'WAITLISTED', 'COMPENSATION_REQUIRED'].includes(target)) {
        const status = target === 'SELECTED' ? 'COMPLETED' : 'CANCELLED';
        extras.leases = [];
        for (const iv of this.db.lookupBy('interviews', 'application_id', appId).filter(x => x.status === 'SCHEDULED')) {
          await txn.update('interviews', iv.interview_id, { status });
          if (iv.lease_id) extras.leases.push(iv.lease_id);
        }
      }

      if (tx) extras = { ...extras, ...(await tx(txn, current)) };

      return txn.update('applications', appId, {
        state: target,
        version: current.version + 1,
        updated_at: new Date().toISOString(),
        ...updates,
      });
    });

    await this.audit.log({
      actor: actor.id, action: `STATE_TRANSITION:${before.state}->${target}`, tableName: 'applications',
      recordId: appId, before, after, correlationId,
    });
    sseService.broadcast('state_change', {
      application_id: appId, student_id: after.student_id, drive_id: after.drive_id,
      from: before.state, to: target, version: after.version, actor: actor.id, timestamp: after.updated_at,
    });
    for (const leaseId of extras.leases || []) teamA.releaseLease(leaseId, correlationId).catch(() => {});
    return { before, after, extras };
  }

  async _notifyStudent(app, target, reason, extra) {
    const copy = STATE_COPY[target];
    if (!copy) return;
    const drive = this._drive(app.drive_id) || { title: app.drive_id };
    await this.notify.notify(app.student_id, {
      type: target, title: copy.title, message: copy.msg(drive, reason, extra), entityId: app.application_id,
    });
  }

  // ── public: staff / student transitions ──────────────────────────────────

  async transition(appId, target, { actor, reason, payload = {}, expectedVersion, correlationId } = {}) {
    const app = this._getApp(appId);
    this._authorise(app, target, actor);

    if (target === 'INTERVIEW_SCHEDULED') {
      return this.scheduleInterview(appId, payload, { actor, correlationId, expectedVersion });
    }

    const updates = {};
    if (reason) updates.status_reason = String(reason).slice(0, 500);
    let tx;
    let offerSummary = null;

    if (target === 'SELECTED') {
      tx = async (txn, current) => {
        const drive = await txn.readForUpdate('drives', current.drive_id);
        if (drive.seats <= 0) throw new ConflictError(`Drive '${current.drive_id}' has no available seats — waitlist the candidate instead`);
        await txn.update('drives', current.drive_id, { seats: drive.seats - 1, version: (drive.version || 1) + 1, updated_at: new Date().toISOString() });
        const offerId = `OFR-${uuidv4().substring(0, 8).toUpperCase()}`;
        await txn.insert('offers', offerId, {
          offer_id: offerId, application_id: appId, student_id: current.student_id, drive_id: current.drive_id,
          status: 'PENDING', created_at: new Date().toISOString(), committed_at: null,
        });
        return { offer_id: offerId };
      };
    } else if (target === 'OFFER_ISSUED') {
      const drive = this._drive(app.drive_id);
      const ctc = payload.package_ctc != null ? Number(payload.package_ctc) : drive?.package;
      if (!(ctc > 0)) throw new ValidationError('A positive package_ctc is required to issue an offer', [{ field: 'package_ctc', message: 'Must be > 0' }]);
      const joining = payload.joining_date || null;
      if (joining && Number.isNaN(Date.parse(joining))) throw new ValidationError('joining_date is not a valid date');
      offerSummary = `₹${(ctc / 100000).toFixed(1)} LPA`;
      tx = async (txn, current) => {
        const offer = this.db.lookupBy('offers', 'application_id', appId).find(o => o.status === 'PENDING');
        if (!offer) throw new ConflictError('No pending offer exists for this application');
        await txn.update('offers', offer.offer_id, {
          status: 'COMMITTED', committed_at: new Date().toISOString(), package_ctc: ctc,
          joining_date: joining, role_title: payload.role_title || drive?.title || null,
        });
        return { offer_id: offer.offer_id };
      };
    } else if (target === 'OFFER_ACCEPTED' || target === 'OFFER_DECLINED') {
      tx = async (txn, current) => {
        const offer = this.db.lookupBy('offers', 'application_id', appId).find(o => o.status === 'COMMITTED');
        if (!offer) throw new ConflictError('There is no issued offer to respond to');
        await txn.update('offers', offer.offer_id, {
          status: target === 'OFFER_ACCEPTED' ? 'ACCEPTED' : 'DECLINED', responded_at: new Date().toISOString(),
        });
        return { offer_id: offer.offer_id };
      };
      updates.decision_timestamp = new Date().toISOString();
    }

    const { after, extras } = await this._commit(appId, target, { actor, correlationId, expectedVersion, updates, tx });

    // Notifications
    await this._notifyStudent(after, target, reason, offerSummary);
    const drive = this._drive(after.drive_id) || { title: after.drive_id };
    if (target === 'OFFER_ACCEPTED' || target === 'OFFER_DECLINED') {
      await this.notify.notifyStaff({
        type: target, title: target === 'OFFER_ACCEPTED' ? 'Offer accepted' : 'Offer declined',
        message: `${after.student_id} ${target === 'OFFER_ACCEPTED' ? 'accepted' : 'declined'} the offer for ${drive.title}.`, entityId: appId,
      });
    } else if (target === 'WITHDRAWN' && actor.role === 'student') {
      await this.notify.notifyStaff({ type: 'WITHDRAWN', title: 'Application withdrawn', message: `${after.student_id} withdrew from ${drive.title}.`, entityId: appId });
    }
    return { ...after, offer_id: extras.offer_id || null };
  }

  // ── interview scheduling with Team A slot lease (A3 + C3 compensation) ───

  async scheduleInterview(appId, payload = {}, { actor, correlationId, expectedVersion } = {}) {
    const app = this._getApp(appId);
    this._authorise(app, 'INTERVIEW_SCHEDULED', actor);
    if (!['SHORTLISTED', 'INTERVIEW_SCHEDULED'].includes(app.state)) {
      throw new ConflictError(`Interviews can only be scheduled for SHORTLISTED applications (current: ${app.state})`);
    }
    const scheduledAt = payload.scheduled_at || new Date(Date.now() + 86400000).toISOString();
    if (Number.isNaN(Date.parse(scheduledAt))) throw new ValidationError('scheduled_at must be a valid date-time', [{ field: 'scheduled_at', message: 'Invalid date' }]);
    const iso = new Date(scheduledAt).toISOString();
    const slotId = payload.slot_id || `${app.drive_id}@${iso}`;

    // Reschedule: cancel the previous booking first (its lease is released after commit)
    let cancelled = null;
    if (payload.reschedule_interview_id) {
      cancelled = this.db.table('interviews').findById(payload.reschedule_interview_id);
      if (!cancelled || cancelled.application_id !== appId) throw new NotFoundError('Interview', payload.reschedule_interview_id);
    }

    // 1. Reserve the slot with Team A (exclusive, no two candidates in the same slot)
    let lease;
    try {
      const leaseMs = Math.min(Math.max(Date.parse(iso) - Date.now(), 0) + 2 * 3600 * 1000, 14 * 24 * 3600 * 1000);
      lease = await teamA.acquireSlot({ slot_id: slotId, holder_id: app.student_id, mode: 'EXCLUSIVE', lease_timeout_ms: leaseMs }, correlationId);
    } catch (err) {
      throw new AppError('UPSTREAM_ERROR', `Interview slot service (Team A) is unavailable: ${err.message}`, 503);
    }
    if (!lease.lock_granted) {
      throw new ConflictError(`Interview slot ${iso} is already booked by another candidate`, [{ slot_id: slotId, reason: lease.conflict_reason }]);
    }

    // 2. Commit state + interview row atomically; on failure compensate by releasing the lease
    const interviewId = `INT-${uuidv4().substring(0, 8).toUpperCase()}`;
    try {
      const interviewRow = {
        interview_id: interviewId, application_id: appId, student_id: app.student_id, drive_id: app.drive_id,
        round_name: payload.round_name || 'Technical Interview', scheduled_at: iso, mode: payload.mode || 'Online',
        location_url: payload.location_url || 'https://meet.jit.si/rit-placement-interview', slot_id: slotId,
        lease_id: lease.lease_id, status: 'SCHEDULED', created_at: new Date().toISOString(),
      };
      let result;
      if (app.state === 'SHORTLISTED') {
        result = await this._commit(appId, 'INTERVIEW_SCHEDULED', {
          actor, correlationId, expectedVersion,
          updates: { lease_id: lease.lease_id },
          tx: async (txn) => { await txn.insert('interviews', interviewId, interviewRow); return {}; },
        });
      } else {
        await this.db.transactionIndexed(async (txn) => {
          await txn.insert('interviews', interviewId, interviewRow);
          if (cancelled) await txn.update('interviews', cancelled.interview_id, { status: 'CANCELLED' });
        });
        await this.audit.log({ actor: actor.id, action: 'INTERVIEW_ADDED', tableName: 'interviews', recordId: interviewId, after: interviewRow, correlationId });
        result = { after: this._getApp(appId) };
      }
      if (cancelled?.lease_id) teamA.releaseLease(cancelled.lease_id, correlationId).catch(() => {});

      const drive = this._drive(app.drive_id) || { title: app.drive_id };
      await this.notify.notify(app.student_id, {
        type: 'INTERVIEW_SCHEDULED', title: 'Interview scheduled',
        message: `${interviewRow.round_name} for ${drive.title} on ${new Date(iso).toLocaleString('en-IN')} (${interviewRow.mode}).`,
        entityId: appId,
      });
      return { ...result.after, interview: interviewRow };
    } catch (err) {
      teamA.releaseLease(lease.lease_id, correlationId).catch(() => {});
      await this.audit.log({ actor: actor.id, action: `COMPENSATE: lease ${lease.lease_id} released (${err.message})`, tableName: 'applications', recordId: appId, correlationId }).catch(() => {});
      throw err;
    }
  }

  // ── Apply -> Evaluate -> Rank pipeline ───────────────────────────────────

  async runPipeline(appId, { actor = { id: 'system', role: 'system' }, correlationId } = {}) {
    let app = this._getApp(appId);
    const student = this.db.table('students').findById(app.student_id);
    const drive = this._drive(app.drive_id);
    const criteria = this._criteria(drive);

    if (app.state === 'APPLIED') {
      ({ after: app } = await this._commit(appId, 'SCREENING', { actor, correlationId }));
    }
    if (app.state !== 'SCREENING') return app;

    // Team A — eligibility rules + queue
    let evalRes;
    try {
      evalRes = await teamA.evaluate({
        request_id: `REQ-${appId}`, application_id: appId, student_id: student.student_id, drive_id: drive.drive_id,
        student: this.snapshot(student), criteria, priority: this.priorityFor(student), submitted_at: app.created_at,
      }, correlationId);
    } catch (err) {
      app = await this.db.table('applications').update(appId, { pipeline_status: 'EVALUATION_PENDING', pipeline_error: err.message });
      await this.audit.log({ actor: 'system', action: `PIPELINE_DEGRADED: eligibility engine unavailable (${err.message})`, tableName: 'applications', recordId: appId, correlationId });
      await this.notify.notify(app.student_id, { type: 'PIPELINE', title: 'Eligibility check pending', message: 'Your application is saved. Eligibility will be evaluated as soon as the rule engine is back.', entityId: appId });
      return app;
    }

    const decision = evalRes.decision;
    const target = decision.eligibility_result === 'NOT_ELIGIBLE' ? 'NOT_ELIGIBLE' : 'RULE_EVALUATED';
    const decisionId = `DEC-${uuidv4().substring(0, 8).toUpperCase()}`;
    ({ after: app } = await this._commit(appId, target, {
      actor: { id: 'team-a', role: 'system' }, correlationId,
      updates: {
        decision_id: decisionId, eligibility_result: decision.eligibility_result, failed_rules: decision.failed_rules || [],
        eligibility_request_id: evalRes.request_id, pipeline_status: 'EVALUATED', pipeline_error: null,
        queue_position: evalRes.queue_position || null,
      },
      tx: async (txn) => {
        await txn.insert('eligibility_decisions', decisionId, {
          decision_id: decisionId, application_id: appId, result: decision.eligibility_result,
          failed_rules: decision.failed_rules || [], rule_set_version: decision.rule_set_version,
          lease_id: evalRes.lease?.lease_id || null, metrics: decision.decision_metrics || {},
          criteria_breakdown: decision.criteria_breakdown || [], team_a_decision_id: decision.decision_id,
          strategy: decision.strategy, created_at: new Date().toISOString(),
        });
        return {};
      },
    }));

    await this._notifyStudent(app, target, null);
    if (target === 'RULE_EVALUATED') {
      await this.notify.notifyStaff({
        type: 'APPLICATION_SUBMITTED', title: 'New eligible application',
        message: `${student.name} (${student.student_id}) applied for ${drive.title} — ${decision.eligibility_result}.`, entityId: appId,
      });
      app = await this.rank(appId, { correlationId });
    }
    return app;
  }

  /** Request a ranking from Team B for the application's drive and record this applicant's position. */
  async rank(appId, { correlationId } = {}) {
    const app = this._getApp(appId);
    const drive = this._drive(app.drive_id);
    const pool = this.db.lookupBy('applications', 'drive_id', app.drive_id).filter(a => ACTIVE_FOR_RANKING.includes(a.state));
    const students = pool.map(a => this.db.table('students').findById(a.student_id)).filter(Boolean);
    try {
      const res = await teamB.compute({
        drive_id: drive.drive_id,
        drive: { drive_id: drive.drive_id, title: drive.title, criteria: this._criteria(drive), seats: drive.seats_total || drive.seats },
        candidates: students.map(s => this.snapshot(s)),
        algorithm: 'WEIGHTED_SCORE',
      }, correlationId);
      const me = res.ordered_candidates.find(c => c.student_id === app.student_id);
      return this.db.table('applications').update(appId, {
        ranking_id: res.ranking_id, rank: me ? me.rank : null, rank_score: me ? me.total_score : null,
        rank_pool: res.qualified_count, graph_version: res.graph_version, ranking_status: 'OK',
      });
    } catch (err) {
      await this.audit.log({ actor: 'system', action: `RANKING_DEGRADED: ${err.message}`, tableName: 'applications', recordId: appId, correlationId }).catch(() => {});
      return this.db.table('applications').update(appId, { ranking_status: 'DEGRADED' });
    }
  }

  /** Retry a stalled pipeline (Team A was down) or refresh a degraded ranking. */
  async reevaluate(appId, { actor, correlationId }) {
    const app = this._getApp(appId);
    if (app.state === 'SCREENING' || app.state === 'APPLIED') return this.runPipeline(appId, { actor, correlationId });
    if (ACTIVE_FOR_RANKING.includes(app.state)) return this.rank(appId, { correlationId });
    throw new ConflictError(`Nothing to re-evaluate in state ${app.state}`);
  }

  // ── read models ──────────────────────────────────────────────────────────

  details(appId) {
    const application = this._getApp(appId);
    return {
      application,
      decisions: this.db.lookupBy('eligibility_decisions', 'application_id', appId),
      interviews: this.db.lookupBy('interviews', 'application_id', appId).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
      offers: this.db.lookupBy('offers', 'application_id', appId),
      audit: this.db.lookupBy('audit_log', 'record_id', appId).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map(({ audit_id, actor, action, timestamp, correlation_id }) => ({ audit_id, actor, action, timestamp, correlation_id })),
    };
  }

  /** Move stalled SCREENING applications forward (called at start-up and by /internal/pipeline/retry). */
  async retryStalled(correlationId) {
    const stalled = this.db.table('applications').find(a => a.state === 'SCREENING' || a.state === 'APPLIED');
    let done = 0;
    for (const a of stalled) {
      try { await this.runPipeline(a.application_id, { correlationId }); done++; } catch { /* leave for next retry */ }
    }
    return { examined: stalled.length, processed: done };
  }
}

module.exports = WorkflowService;
module.exports.PERMISSIONS = PERMISSIONS;
