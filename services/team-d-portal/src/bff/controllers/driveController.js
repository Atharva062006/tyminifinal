/**
 * Drive Discovery & Eligibility Controller for Team D BFF.
 */
const { sendSuccess } = require('../utils/apiResponse');
const { NotFoundError, ValidationError } = require('../../../../../shared/errors');
const teamC = require('../services/teamCClient');
const teamA = require('../services/teamAClient');

function parseCriteria(drive) {
  if (drive.criteria && typeof drive.criteria === 'object' && Object.keys(drive.criteria).length > 0) return drive.criteria;
  if (drive.criteria_json) {
    try { return typeof drive.criteria_json === 'string' ? JSON.parse(drive.criteria_json) : drive.criteria_json; } catch { /* fall through */ }
  }
  return {};
}

class DriveController {
  /**
   * GET /api/v1/ui/drives
   * Lists drives with company details; for students also their live eligibility (Team A) and own application.
   */
  list = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;
      const { state, search, branch, min_package, company_id } = req.query;
      const isStudent = req.user?.role === 'student';

      const [drives, companies, student, myApps] = await Promise.all([
        teamC.listDrives({ state }, correlationId),
        teamC.listCompanies(correlationId),
        isStudent ? teamC.getStudent(req.user.id, correlationId).catch(() => null) : Promise.resolve(null),
        isStudent ? teamC.listApplications({ student_id: req.user.id }, correlationId, req.user.actor).catch(() => []) : Promise.resolve([]),
      ]);

      // Students never see drafts
      let visible = isStudent ? drives.filter(d => d.state !== 'DRAFT') : drives;
      const companyMap = new Map(companies.map(c => [c.company_id, c]));
      const appByDrive = new Map();
      for (const a of myApps) {
        const prev = appByDrive.get(a.drive_id);
        if (!prev || (a.created_at || '') > (prev.created_at || '')) appByDrive.set(a.drive_id, a);
      }

      let enriched = await Promise.all(visible.map(async (drive) => {
        const criteria = parseCriteria(drive);
        const out = { ...drive, company: companyMap.get(drive.company_id) || null, criteria };
        if (isStudent) {
          const app = appByDrive.get(drive.drive_id);
          out.my_application = app ? { application_id: app.application_id, state: app.state } : null;
          if (student && drive.state === 'OPEN') {
            try {
              const ev = await teamA.evaluateRules(student, criteria, correlationId);
              out.my_eligibility = { result: ev.eligibility_result, failed_rules: ev.failed_rules };
            } catch { out.my_eligibility = null; }
          }
        }
        return out;
      }));

      if (search) {
        const q = search.toLowerCase();
        enriched = enriched.filter(d => (d.title || '').toLowerCase().includes(q) || (d.company?.name || '').toLowerCase().includes(q));
      }
      if (branch) {
        enriched = enriched.filter(d => {
          const branches = d.criteria.branches || d.criteria.allowed_branches || [];
          return branches.length === 0 || branches.includes(branch);
        });
      }
      if (company_id) enriched = enriched.filter(d => d.company_id === company_id);
      if (min_package) enriched = enriched.filter(d => (d.package || 0) >= parseFloat(min_package));

      sendSuccess(res, enriched, correlationId);
    } catch (err) { next(err); }
  };

  /** GET /api/v1/ui/companies */
  listCompanies = async (req, res, next) => {
    try { sendSuccess(res, await teamC.listCompanies(req.correlationId), req.correlationId); } catch (err) { next(err); }
  };

  /** POST /api/v1/ui/companies  (staff) */
  createCompany = async (req, res, next) => {
    try { sendSuccess(res, await teamC.createCompany(req.body || {}, req.user.actor, req.correlationId), req.correlationId, 201); } catch (err) { next(err); }
  };

  /** PATCH /api/v1/ui/companies/:companyId  (staff) */
  updateCompany = async (req, res, next) => {
    try { sendSuccess(res, await teamC.updateCompany(req.params.companyId, req.body || {}, req.user.actor, req.correlationId), req.correlationId); } catch (err) { next(err); }
  };

  /** GET /api/v1/ui/drives/:driveId — detail with criteria, seats and the live Team A queue. */
  get = async (req, res, next) => {
    try {
      const { driveId } = req.params;
      const correlationId = req.correlationId;
      const drive = await teamC.getDrive(driveId, correlationId);
      if (!drive) throw new NotFoundError('Drive', driveId);
      if (req.user?.role === 'student' && drive.state === 'DRAFT') throw new NotFoundError('Drive', driveId);

      const company = drive.company_id ? await teamC.getCompany(drive.company_id, correlationId).catch(() => null) : null;
      const queueStatus = await teamA.getDriveQueue(driveId, correlationId).catch(() => null);
      sendSuccess(res, { ...drive, company, criteria: parseCriteria(drive), queue_status: queueStatus }, correlationId);
    } catch (err) { next(err); }
  };

  /** POST /api/v1/ui/drives  (staff) */
  create = async (req, res, next) => {
    try {
      const body = { ...req.body };
      if (!body.company_id) throw new ValidationError('company_id is required', [{ field: 'company_id', message: 'Required' }]);
      if (!body.title) throw new ValidationError('title is required', [{ field: 'title', message: 'Required' }]);
      body.seats = Number(body.seats);
      if (!Number.isInteger(body.seats) || body.seats < 1) throw new ValidationError('seats must be a positive integer', [{ field: 'seats', message: 'Invalid' }]);
      sendSuccess(res, await teamC.createDrive(body, req.user.actor, req.correlationId), req.correlationId, 201);
    } catch (err) { next(err); }
  };

  /** PATCH /api/v1/ui/drives/:driveId — criteria / seats / state / details (staff). */
  update = async (req, res, next) => {
    try {
      const updates = { ...req.body };
      if (updates.criteria && typeof updates.criteria === 'object') {
        updates.criteria_json = JSON.stringify(updates.criteria);
        delete updates.criteria;
      }
      sendSuccess(res, await teamC.updateDrive(req.params.driveId, updates, req.correlationId, req.user.actor), req.correlationId);
    } catch (err) { next(err); }
  };

  /**
   * GET /api/v1/ui/eligibility/check/:driveId
   * Evaluates a student's eligibility for a drive via Team A (strategy selectable for comparison).
   */
  checkEligibility = async (req, res, next) => {
    try {
      const { driveId } = req.params;
      const correlationId = req.correlationId;
      const studentId = (req.user?.role === 'student' ? req.user.id : req.query.student_id) || req.user?.id;
      if (!studentId) throw new ValidationError('Student ID is required to evaluate eligibility');

      const [drive, student] = await Promise.all([
        teamC.getDrive(driveId, correlationId),
        teamC.getStudent(studentId, correlationId).catch(() => null),
      ]);
      if (!drive) throw new NotFoundError('Drive', driveId);
      if (!student) throw new NotFoundError('Student', studentId);

      const criteria = parseCriteria(drive);
      const decision = await teamA.evaluateRules(student, criteria, correlationId, req.query.strategy);

      sendSuccess(res, {
        student: {
          student_id: student.student_id, name: student.name, cgpa: student.cgpa, backlogs: student.backlogs,
          branch: student.branch, attendance: student.attendance, skills: student.skills,
        },
        drive: { drive_id: drive.drive_id, title: drive.title, criteria, seats: drive.seats, state: drive.state },
        evaluation: decision,
      }, correlationId);
    } catch (err) { next(err); }
  };
}

module.exports = new DriveController();
