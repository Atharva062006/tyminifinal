/**
 * ApplicationService — Core business logic for placement applications (C2).
 *
 * Orchestrates:
 *   - Idempotency check (same key => same outcome, never a second row)
 *   - Master data validation (student exists, drive is OPEN with seats)
 *   - ACID insert guarded by logical locks (no duplicate applications under concurrency)
 *   - Hand-off to the WorkflowService (Team A evaluate -> Team B rank)
 *   - Audit logging
 */

const { v4: uuidv4 } = require('uuid');
const { ConflictError, NotFoundError, ValidationError } = require('../../../../shared/errors');

const INACTIVE = ['WITHDRAWN', 'EXPIRED', 'NOT_ELIGIBLE', 'REJECTED', 'OFFER_DECLINED'];

class ApplicationService {
  /**
   * @param {Database}           db
   * @param {IdempotencyService} idempotencyService
   * @param {AuditService}       auditService
   * @param {WorkflowService}    workflow
   */
  constructor(db, idempotencyService, auditService, workflow) {
    this.db = db;
    this.idempotencyService = idempotencyService;
    this.auditService = auditService;
    this.workflow = workflow;
  }

  async createApplication({ student_id, drive_id, resume_version, consent, idempotency_key, correlationId, actor }) {
    if (!idempotency_key) throw new ValidationError('idempotency_key is required');
    if (consent !== true) throw new ValidationError('Student consent is required to submit an application', [{ field: 'consent', message: 'Must be true' }]);

    // 1. Idempotency: replay the original outcome
    const cached = await this.idempotencyService.getStoredResponse(idempotency_key);
    if (cached) return this.db.table('applications').findById(cached.application_id) || cached;

    // 2. Master data checks
    const student = this.db.table('students').findById(student_id);
    if (!student) throw new NotFoundError('Student', student_id);
    const drive = this.db.table('drives').findById(drive_id);
    if (!drive) throw new NotFoundError('Drive', drive_id);
    if (drive.state !== 'OPEN') throw new ConflictError(`Drive '${drive_id}' is not open for applications (state: ${drive.state})`);
    if (drive.seats <= 0) throw new ConflictError(`Drive '${drive_id}' has no available seats`);

    // 3. Insert under logical locks so concurrent duplicates cannot both pass the check
    const application_id = uuidv4();
    const now = new Date().toISOString();
    const row = {
      application_id, student_id, drive_id, state: 'APPLIED', resume_version: resume_version || null,
      consent: true, idempotency_key, version: 1, created_at: now, updated_at: now,
      pipeline_status: 'QUEUED',
    };

    let existingByKey = null;
    await this.db.transactionIndexed(async (txn) => {
      await txn.lock(`uniq:idem:${idempotency_key}`);
      await txn.lock(`uniq:app:${student_id}:${drive_id}`);
      const sameKey = this.db.lookupBy('applications', 'idempotency_key', idempotency_key)[0];
      if (sameKey) { existingByKey = sameKey; return; }
      const dup = this.db.lookupBy('applications', 'student_id', student_id)
        .filter(a => a.drive_id === drive_id && !INACTIVE.includes(a.state));
      if (dup.length > 0) {
        throw new ConflictError(`Student '${student_id}' already has an active application for drive '${drive_id}'`);
      }
      await txn.insert('applications', application_id, row);
    });
    if (existingByKey) return existingByKey;

    await this.auditService.log({
      actor: actor?.id || student_id, action: 'CREATE_APPLICATION', tableName: 'applications',
      recordId: application_id, before: null, after: row, correlationId,
    });

    // 4. Apply -> Evaluate -> Rank (degrades gracefully if Team A / B are down)
    let final = row;
    try {
      final = await this.workflow.runPipeline(application_id, { correlationId });
    } catch (err) {
      final = this.db.table('applications').findById(application_id) || row;
      await this.auditService.log({ actor: 'system', action: `PIPELINE_ERROR: ${err.message}`, tableName: 'applications', recordId: application_id, correlationId }).catch(() => {});
    }

    await this.idempotencyService.storeResponse(idempotency_key, { application_id, state: final.state });
    return final;
  }

  getApplication(applicationId) {
    const app = this.db.table('applications').findById(applicationId);
    if (!app) throw new NotFoundError('Application', applicationId);
    return app;
  }

  /** Withdraw (student for own application, or staff). Releases seats/leases via the workflow. */
  async withdrawApplication(applicationId, actor, correlationId) {
    return this.workflow.transition(applicationId, 'WITHDRAWN', { actor, correlationId });
  }

  /** List with index-backed filters. */
  listApplications({ student_id, drive_id, state } = {}) {
    let apps;
    if (student_id) apps = this.db.lookupBy('applications', 'student_id', student_id);
    else if (drive_id) apps = this.db.lookupBy('applications', 'drive_id', drive_id);
    else apps = this.db.table('applications').all();
    if (student_id && drive_id) apps = apps.filter(a => a.drive_id === drive_id);
    if (state) apps = apps.filter(a => a.state === state);
    return apps.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }
}

module.exports = ApplicationService;
