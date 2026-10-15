/**
 * OfferService — Commit and compensation of decisions/offers (C3).
 *
 * commitOffer  : atomically moves an application to `targetState` (optimistic version check), records the
 *                decision (with the Team A lease id) and applies seat/offer side-effects through the
 *                WorkflowService so the internal API and the staff UI share exactly one code path.
 * compensate   : releases the Team A lease, frees any claimed seat, marks the application
 *                COMPENSATION_REQUIRED and records a compensating audit event.
 */

const { v4: uuidv4 } = require('uuid');
const { NotFoundError } = require('../../../../shared/errors');
const { teamA } = require('./engineClients');

class OfferService {
  /**
   * @param {Database}        db
   * @param {AuditService}    auditService
   * @param {WorkflowService} workflow
   */
  constructor(db, auditService, workflow) {
    this.db = db;
    this.auditService = auditService;
    this.workflow = workflow;
  }

  async commitOffer({ applicationId, decisionResult, targetState, leaseId, expectedVersion, correlationId, actor, payload }) {
    const app = this.db.table('applications').findById(applicationId);
    if (!app) throw new NotFoundError('Application', applicationId);

    const decisionId = uuidv4();
    const decision = {
      decision_id: decisionId, application_id: applicationId, result: decisionResult,
      failed_rules: [], lease_id: leaseId || null, created_at: new Date().toISOString(),
    };

    try {
      const application = await this.workflow.transition(applicationId, targetState, {
        actor: { id: actor || 'system', role: 'system' }, expectedVersion, correlationId, payload: payload || {},
        reason: `Committed with decision ${decisionResult}`,
      });
      await this.db.table('eligibility_decisions').insert(decision);
      return { application, decision };
    } catch (err) {
      // C3: commit failed after a lease was granted -> release it and record the compensation
      if (leaseId) {
        await teamA.releaseLease(leaseId, correlationId).catch(() => {});
        await this.auditService.log({
          actor: actor || 'system', action: `COMPENSATE: lease ${leaseId} released after failed commit (${err.message})`,
          tableName: 'applications', recordId: applicationId, correlationId,
        }).catch(() => {});
      }
      throw err;
    }
  }

  async compensate({ applicationId, reason, correlationId, actor, leaseId }) {
    const app = this.db.table('applications').findById(applicationId);
    if (!app) throw new NotFoundError('Application', applicationId);

    const holdsSeat = ['SELECTED', 'OFFER_ISSUED'].includes(app.state);
    const updated = await this.db.transactionIndexed(async (txn) => {
      if (holdsSeat) {
        const drive = await txn.readForUpdate('drives', app.drive_id);
        await txn.update('drives', app.drive_id, { seats: drive.seats + 1, version: (drive.version || 1) + 1, updated_at: new Date().toISOString() });
        for (const o of this.db.lookupBy('offers', 'application_id', applicationId).filter(x => ['PENDING', 'COMMITTED'].includes(x.status))) {
          await txn.update('offers', o.offer_id, { status: 'COMPENSATED' });
        }
      }
      return txn.update('applications', applicationId, {
        state: 'COMPENSATION_REQUIRED', version: app.version + 1, updated_at: new Date().toISOString(),
      });
    });

    const leases = [leaseId, app.lease_id].filter(Boolean);
    for (const l of leases) await teamA.releaseLease(l, correlationId).catch(() => {});

    await this.auditService.log({
      actor: actor || 'system', action: `COMPENSATE: ${reason}`, tableName: 'applications',
      recordId: applicationId, before: app, after: updated, correlationId,
    });
    return updated;
  }
}

module.exports = OfferService;
