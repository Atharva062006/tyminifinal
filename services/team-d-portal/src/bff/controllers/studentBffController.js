/**
 * Team D BFF Student Profile & Placement Readiness Controller.
 * Proxies student queries/updates to Team C and computes advisory Placement Readiness scores.
 */
const teamCClient = require('../services/teamCClient');
const { sendSuccess } = require('../utils/apiResponse');
const { ForbiddenError, NotFoundError } = require('../../../../../shared/errors');

function computePlacementReadiness(student) {
  let score = 0;
  const breakdown = {
    academics: 0,
    skills: 0,
    resume: 0,
    projects: 0,
    certifications: 0
  };
  const recommendations = [];

  // 1. Academic Readiness (Max 30 pts)
  const cgpa = student.cgpa || 0;
  const backlogs = student.backlogs ?? 0;
  const attendance = student.attendance ?? 0;

  if (cgpa >= 8.5) breakdown.academics += 15;
  else if (cgpa >= 7.5) breakdown.academics += 12;
  else if (cgpa >= 6.5) breakdown.academics += 8;
  else recommendations.push('Focus on improving CGPA above 7.5 for maximum drive eligibility');

  if (backlogs === 0) breakdown.academics += 10;
  else recommendations.push('Clear active backlogs to unlock premium placement drives');

  if (attendance >= 85) breakdown.academics += 5;
  else if (attendance >= 75) breakdown.academics += 3;
  else recommendations.push('Maintain attendance above 85%');

  // 2. Skills Readiness (Max 25 pts)
  const skills = Array.isArray(student.skills) ? student.skills : [];
  if (skills.length >= 5) breakdown.skills = 25;
  else if (skills.length >= 3) breakdown.skills = 18;
  else if (skills.length >= 1) breakdown.skills = 10;
  else recommendations.push('Add at least 3 core technical skills to your profile');

  // 3. Resume Readiness (Max 15 pts)
  if (student.resume_url || student.has_resume) {
    breakdown.resume = 15;
  } else {
    recommendations.push('Upload your updated resume PDF');
  }

  // 4. Projects (Max 15 pts)
  const projects = Array.isArray(student.projects) ? student.projects : [];
  if (projects.length >= 2) breakdown.projects = 15;
  else if (projects.length === 1) breakdown.projects = 10;
  else recommendations.push('Add 2 technical projects with GitHub / live demo links');

  // 5. Certifications (Max 15 pts)
  const certs = Array.isArray(student.certifications) ? student.certifications : [];
  if (certs.length >= 2) breakdown.certifications = 15;
  else if (certs.length === 1) breakdown.certifications = 10;
  else recommendations.push('Add a technical certification to boost your placement readiness');

  score = Object.values(breakdown).reduce((a, b) => a + b, 0);

  return {
    readiness_score: score,
    breakdown,
    recommendations
  };
}

class StudentBffController {
  // GET /api/v1/ui/students  (staff directory)
  list = async (req, res, next) => {
    try {
      const students = await teamCClient.listStudents(req.correlationId, { branch: req.query.branch, q: req.query.q, min_cgpa: req.query.min_cgpa });
      const withScores = students.map(s => ({ ...s, readiness_score: computePlacementReadiness(s).readiness_score }));
      sendSuccess(res, withScores, req.correlationId);
    } catch (err) { next(err); }
  };

  // POST /api/v1/ui/students  (staff creates a student together with a login)
  create = async (req, res, next) => {
    try { sendSuccess(res, await teamCClient.createStudent(req.body || {}, req.user.actor, req.correlationId), req.correlationId, 201); } catch (err) { next(err); }
  };

  // GET /api/v1/ui/students/:studentId
  getProfile = async (req, res, next) => {
    try {
      const { studentId } = req.params;
      if (req.user?.role === 'student' && req.user?.id !== studentId) {
        throw new ForbiddenError('Students can only view their own profile');
      }
      const student = await teamCClient.getStudent(studentId, req.correlationId);
      if (!student) throw new NotFoundError('Student', studentId);
      sendSuccess(res, { student, readiness: computePlacementReadiness(student) }, req.correlationId);
    } catch (err) { next(err); }
  };

  // PATCH /api/v1/ui/students/:studentId — students edit their own profile; staff may edit and verify any
  updateProfile = async (req, res, next) => {
    try {
      const { studentId } = req.params;
      if (req.user?.role === 'student' && req.user?.id !== studentId) {
        throw new ForbiddenError('Students can only modify their own profile');
      }
      const updated = await teamCClient.updateStudent(studentId, { ...req.body }, req.correlationId, req.user.actor);
      sendSuccess(res, { student: updated, readiness: computePlacementReadiness(updated) }, req.correlationId);
    } catch (err) { next(err); }
  };

  // GET /api/v1/ui/students/:studentId/readiness
  getReadiness = async (req, res, next) => {
    try {
      const { studentId } = req.params;
      if (req.user?.role === 'student' && req.user?.id !== studentId) throw new ForbiddenError('Students can only view their own readiness score');
      const student = await teamCClient.getStudent(studentId, req.correlationId);
      if (!student) throw new NotFoundError('Student', studentId);
      sendSuccess(res, computePlacementReadiness(student), req.correlationId);
    } catch (err) { next(err); }
  };
}

module.exports = new StudentBffController();
