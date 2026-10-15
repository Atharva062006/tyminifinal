const { sendSuccess } = require('../../../../shared/response');
const { NotFoundError, ForbiddenError, ValidationError } = require('../../../../shared/errors');
const { teamB } = require('../services/engineClients');

const ACADEMIC = ['cgpa', 'backlogs', 'attendance', 'branch'];
const EDITABLE = ['name', 'phone', 'year', 'about', 'resume_url', 'github_url', 'linkedin_url', 'skills', 'projects', 'certifications', ...ACADEMIC];

class StudentController {
  constructor(db, authService, workflow) {
    this.db = db;
    this.authService = authService;
    this.workflow = workflow;
  }

  _syncProfile(student) {
    teamB.putStudent(student.student_id, this.workflow.snapshot(student)).catch(() => {});
  }

  // GET /api/v1/students  (staff)
  list = (req, res, next) => {
    try {
      const { branch, min_cgpa, q } = req.query;
      let students = this.db.table('students').all();
      if (branch) students = students.filter(s => s.branch === branch);
      if (min_cgpa) students = students.filter(s => s.cgpa >= parseFloat(min_cgpa));
      if (q) {
        const needle = String(q).toLowerCase();
        students = students.filter(s => `${s.student_id} ${s.name} ${s.email}`.toLowerCase().includes(needle));
      }
      sendSuccess(res, students.sort((a, b) => a.student_id.localeCompare(b.student_id)), req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/students/:studentId
  get = (req, res, next) => {
    try {
      const { studentId } = req.params;
      if (req.user.role === 'student' && req.user.id !== studentId) throw new ForbiddenError('Students can only view their own profile');
      const student = this.db.table('students').findById(studentId);
      if (!student) throw new NotFoundError('Student', studentId);
      sendSuccess(res, student, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v1/students  (staff creates a student together with a login)
  create = async (req, res, next) => {
    try {
      const out = await this.authService.registerStudent({ password: 'student123', ...req.body }, req.correlationId);
      this._syncProfile(out.student);
      sendSuccess(res, { ...out.student, temporary_password: req.body.password ? undefined : 'student123' }, req.correlationId, 201);
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v1/students/:studentId
  update = async (req, res, next) => {
    try {
      const { studentId } = req.params;
      const isSelf = req.user.role === 'student' && req.user.id === studentId;
      if (req.user.role === 'student' && !isSelf) throw new ForbiddenError('Students can only modify their own profile');
      const before = this.db.table('students').findById(studentId);
      if (!before) throw new NotFoundError('Student', studentId);

      const updates = {};
      for (const k of EDITABLE) if (req.body[k] !== undefined) updates[k] = req.body[k];
      if (req.user.role !== 'student' && req.body.academic_verified !== undefined) updates.academic_verified = Boolean(req.body.academic_verified);
      for (const k of ['cgpa', 'backlogs', 'attendance', 'year']) {
        if (updates[k] !== undefined && updates[k] !== null && updates[k] !== '') updates[k] = Number(updates[k]);
        else if (updates[k] === '' || updates[k] === null) delete updates[k];
      }
      for (const k of ['skills', 'projects', 'certifications']) {
        if (updates[k] !== undefined && !Array.isArray(updates[k])) throw new ValidationError(`${k} must be a list`, [{ field: k, message: 'Must be an array' }]);
      }
      if (!Object.keys(updates).length) throw new ValidationError('No editable fields supplied');

      // Students changing their own academic record must be re-verified by the placement cell
      if (isSelf && ACADEMIC.some(k => updates[k] !== undefined && updates[k] !== before[k])) updates.academic_verified = false;
      updates.updated_at = new Date().toISOString();

      const student = await this.db.table('students').update(studentId, updates);
      if (updates.name) {
        const user = this.db.table('users').findById(studentId);
        if (user) await this.db.table('users').update(studentId, { name: updates.name });
      }
      this._syncProfile(student);
      await this.workflow.audit.log({ actor: req.user.id, action: 'UPDATE_STUDENT', tableName: 'students', recordId: studentId, before, after: student, correlationId: req.correlationId });
      sendSuccess(res, student, req.correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = StudentController;
