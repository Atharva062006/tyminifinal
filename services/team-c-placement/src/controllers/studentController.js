const { sendSuccess } = require('../../../../shared/response');
const { NotFoundError } = require('../../../../shared/errors');
const { v4: uuidv4 } = require('uuid');

class StudentController {
  constructor(db) {
    this.db = db;
  }

  // GET /api/v1/students
  list = async (req, res, next) => {
    try {
      const { branch, min_cgpa } = req.query;
      let students = this.db.table('students').all();
      if (branch) {
        students = students.filter(s => s.branch === branch);
      }
      if (min_cgpa) {
        const minVal = parseFloat(min_cgpa);
        students = students.filter(s => s.cgpa >= minVal);
      }
      sendSuccess(res, students, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/students/:studentId
  get = async (req, res, next) => {
    try {
      const { studentId } = req.params;
      const student = this.db.table('students').findById(studentId);
      if (!student) {
        throw new NotFoundError(`Student '${studentId}' not found`);
      }
      sendSuccess(res, student, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v1/students
  create = async (req, res, next) => {
    try {
      const studentId = req.body.student_id || uuidv4();
      const student = {
        student_id: studentId,
        ...req.body,
        created_at: new Date().toISOString()
      };
      const created = await this.db.table('students').insert(student);
      sendSuccess(res, created, req.correlationId, 201);
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v1/students/:studentId
  update = async (req, res, next) => {
    try {
      const { studentId } = req.params;
      const updated = await this.db.table('students').update(studentId, req.body);
      sendSuccess(res, updated, req.correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = StudentController;
