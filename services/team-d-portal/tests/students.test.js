const request = require('supertest');
const app = require('../server');

describe('Team D BFF — Student Profile & Academic Data Flow', () => {
  it('1. GET /api/v1/ui/students/STU001 should allow student to view own profile', async () => {
    const res = await request(app)
      .get('/api/v1/ui/students/STU001')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.student).toBeDefined();
    expect(res.body.data.student.student_id).toBe('STU001');
    expect(res.body.data.readiness).toBeDefined();
    expect(typeof res.body.data.readiness.readiness_score).toBe('number');
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  it('2. GET /api/v1/ui/students/STU002 should reject student STU001 with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/ui/students/STU002')
      .set('Authorization', 'Bearer student_STU001')
      .expect(403);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('3. GET /api/v1/ui/students/STU001 should allow Faculty/Admin to view student profile', async () => {
    const res = await request(app)
      .get('/api/v1/ui/students/STU001')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(200);

    expect(res.body.data.student.student_id).toBe('STU001');
  });

  it('4. GET /api/v1/ui/students/STU999 should return 404 Not Found for non-existent student', async () => {
    const res = await request(app)
      .get('/api/v1/ui/students/STU999')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(404);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('5. PATCH /api/v1/ui/students/STU001 should allow student to update skills', async () => {
    const res = await request(app)
      .patch('/api/v1/ui/students/STU001')
      .set('Authorization', 'Bearer student_STU001')
      .send({ skills: ['JavaScript', 'Python', 'React', 'Node.js'] })
      .expect(200);

    expect(res.body.data.student.skills).toContain('React');
  });

  it('6. PATCH /api/v1/ui/students/STU001 should strip CGPA tamper attempts by student', async () => {
    const res = await request(app)
      .patch('/api/v1/ui/students/STU001')
      .set('Authorization', 'Bearer student_STU001')
      .send({ cgpa: 10.0, skills: ['Python', 'SQL'] })
      .expect(200);

    // Student profile CGPA should not be tampered by student request body
    expect(res.body.data.student.cgpa).not.toBe(10.0);
  });

  it('7. PATCH /api/v1/ui/students/STU002 should reject student STU001 update attempt with 403', async () => {
    const res = await request(app)
      .patch('/api/v1/ui/students/STU002')
      .set('Authorization', 'Bearer student_STU001')
      .send({ skills: ['Hacking'] })
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('8. Unauthenticated requests to /students/STU001 should return 401 Unauthorized', async () => {
    const res = await request(app)
      .get('/api/v1/ui/students/STU001')
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('9. Academic metrics accurately preserve 0 backlogs as number 0', async () => {
    const res = await request(app)
      .get('/api/v1/ui/students/STU001')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    const backlogs = res.body.data.student.backlogs;
    expect(backlogs).toBeDefined();
    expect(typeof backlogs).toBe('number');
    expect(backlogs).toBe(0);
  });

  it('10. Placement Readiness score evaluates metrics within 0 to 100 range', async () => {
    const res = await request(app)
      .get('/api/v1/ui/students/STU001/readiness')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    const readiness = res.body.data;
    expect(readiness.readiness_score).toBeGreaterThanOrEqual(0);
    expect(readiness.readiness_score).toBeLessThanOrEqual(100);
    expect(readiness.breakdown).toBeDefined();
  });
});
