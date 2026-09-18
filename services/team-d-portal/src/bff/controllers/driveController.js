/**
 * Drive Discovery & Eligibility Controller for Team D BFF.
 */
const { sendSuccess } = require('../utils/apiResponse');
const { NotFoundError, ValidationError } = require('../../../../../shared/errors');
const teamC = require('../services/teamCClient');
const teamA = require('../services/teamAClient');

class DriveController {
  /**
   * GET /api/v1/ui/drives
   * Lists drives with company details and optional student eligibility status.
   */
  list = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;
      const { state, search, branch, min_package } = req.query;

      const [drives, companies] = await Promise.all([
        teamC.listDrives({ state }, correlationId),
        teamC.listCompanies(correlationId)
      ]);

      const companyMap = new Map(companies.map(c => [c.company_id, c]));

      let student = null;
      if (req.user?.role === 'student') {
        student = await teamC.getStudent(req.user.id, correlationId).catch(() => null);
      }

      let enrichedDrives = drives.map(drive => {
        const company = companyMap.get(drive.company_id) || null;
        let criteria = {};
        if (drive.criteria && typeof drive.criteria === 'object' && Object.keys(drive.criteria).length > 0) {
          criteria = drive.criteria;
        } else if (drive.criteria_json) {
          try {
            criteria = typeof drive.criteria_json === 'string' ? JSON.parse(drive.criteria_json) : drive.criteria_json;
          } catch {}
        }

        return {
          ...drive,
          company,
          criteria
        };
      });

      // Filter by search query (company name or title)
      if (search) {
        const q = search.toLowerCase();
        enrichedDrives = enrichedDrives.filter(d => 
          (d.title && d.title.toLowerCase().includes(q)) ||
          (d.company && d.company.name && d.company.name.toLowerCase().includes(q))
        );
      }

      // Filter by branch
      if (branch) {
        enrichedDrives = enrichedDrives.filter(d => {
          const branches = d.criteria.branches || d.criteria.allowed_branches || [];
          return branches.length === 0 || branches.includes(branch);
        });
      }

      // Filter by package
      if (min_package) {
        const minPkg = parseFloat(min_package);
        enrichedDrives = enrichedDrives.filter(d => (d.package || 0) >= minPkg);
      }

      sendSuccess(res, enrichedDrives, correlationId);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/ui/companies
   * Lists registered partner companies.
   */
  listCompanies = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;
      const companies = await teamC.listCompanies(correlationId);
      sendSuccess(res, companies, correlationId);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/ui/drives/:driveId
   * Detailed drive view with criteria and seats.
   */
  get = async (req, res, next) => {
    try {
      const { driveId } = req.params;
      const correlationId = req.correlationId;

      const drive = await teamC.getDrive(driveId, correlationId);
      if (!drive) {
        throw new NotFoundError('Drive', driveId);
      }

      let company = null;
      if (drive.company_id) {
        company = await teamC.getCompany(drive.company_id, correlationId).catch(() => null);
      }

      let criteria = {};
      if (drive.criteria && typeof drive.criteria === 'object' && Object.keys(drive.criteria).length > 0) {
        criteria = drive.criteria;
      } else if (drive.criteria_json) {
        try {
          criteria = typeof drive.criteria_json === 'string' ? JSON.parse(drive.criteria_json) : drive.criteria_json;
        } catch {}
      }

      // Get current queue state from Team A
      const queueStatus = await teamA.getDriveQueue(driveId, correlationId).catch(() => null);

      sendSuccess(res, {
        ...drive,
        company,
        criteria,
        queue_status: queueStatus
      }, correlationId);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /api/v1/ui/drives/:driveId
   * Placement Admin modifies drive details / seats / criteria.
   */
  update = async (req, res, next) => {
    try {
      const { driveId } = req.params;
      const correlationId = req.correlationId;
      const authHeader = req.user?.authHeader || 'Bearer admin_ADM001';

      const updates = { ...req.body };
      if (updates.criteria && typeof updates.criteria === 'object') {
        updates.criteria_json = JSON.stringify(updates.criteria);
        delete updates.criteria;
      }

      const updated = await teamC.updateDrive(driveId, updates, correlationId, authHeader);
      sendSuccess(res, updated, correlationId);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/ui/eligibility/check/:driveId
   * Evaluates student's eligibility for a drive via Team A.
   */
  checkEligibility = async (req, res, next) => {
    try {
      const { driveId } = req.params;
      const correlationId = req.correlationId;
      const studentId = req.query.student_id || req.user?.id;

      if (!studentId) {
        throw new ValidationError('Student ID is required to evaluate eligibility');
      }

      const [drive, student] = await Promise.all([
        teamC.getDrive(driveId, correlationId),
        teamC.getStudent(studentId, correlationId).catch(() => null)
      ]);

      if (!drive) throw new NotFoundError('Drive', driveId);
      if (!student) throw new NotFoundError('Student', studentId);

      const criteria = drive.criteria_json ? JSON.parse(drive.criteria_json) : {};

      // Execute rule evaluation via Team A
      const decision = await teamA.evaluateRules(student, criteria, correlationId);

      sendSuccess(res, {
        student: {
          student_id: student.student_id,
          name: student.name,
          cgpa: student.cgpa,
          backlogs: student.backlogs,
          branch: student.branch,
          attendance: student.attendance,
          skills: student.skills
        },
        drive: {
          drive_id: drive.drive_id,
          title: drive.title,
          criteria
        },
        evaluation: decision
      }, correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new DriveController();
