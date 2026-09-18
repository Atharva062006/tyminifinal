const request = require('supertest');
const app = require('../server');

describe('Team D BFF — Placement Drive & Eligibility Workflow', () => {
  it('1. GET /api/v1/ui/drives should list active placement drives', async () => {
    const res = await request(app)
      .get('/api/v1/ui/drives')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].drive_id).toBeDefined();
  });

  it('2. GET /api/v1/ui/drives/DRV001 should return detailed drive info', async () => {
    const res = await request(app)
      .get('/api/v1/ui/drives/DRV001')
      .expect(200);

    expect(res.body.data.drive_id).toBe('DRV001');
    expect(res.body.data.title).toBeDefined();
    expect(res.body.data.criteria).toBeDefined();
  });

  it('3. GET /api/v1/ui/eligibility/check/DRV001 evaluates student eligibility', async () => {
    const res = await request(app)
      .get('/api/v1/ui/eligibility/check/DRV001?student_id=STU001')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    expect(res.body.data.student.student_id).toBe('STU001');
    expect(res.body.data.drive.drive_id).toBe('DRV001');
    expect(res.body.data.evaluation).toBeDefined();
  });

  it('4. Eligible student evaluation yields ELIGIBLE status', async () => {
    const res = await request(app)
      .get('/api/v1/ui/eligibility/check/DRV001?student_id=STU001')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    expect(res.body.data.evaluation.eligibility_result).toBe('ELIGIBLE');
  });

  it('5. Ineligible student (low CGPA/high backlogs) yields NOT_ELIGIBLE or failed rules', async () => {
    const res = await request(app)
      .get('/api/v1/ui/eligibility/check/DRV002?student_id=STU004')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(200);

    expect(res.body.data.evaluation.eligibility_result).toBe('NOT_ELIGIBLE');
    expect(res.body.data.evaluation.failed_rules.length).toBeGreaterThan(0);
  });

  it('6. Eligibility explanation returns criteria breakdown and failed/passed rules', async () => {
    const res = await request(app)
      .get('/api/v1/ui/eligibility/check/DRV001?student_id=STU001')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    const ev = res.body.data.evaluation;
    expect(ev.strategy).toBeDefined();
    expect(ev.decision_id).toBeDefined();
    expect(Array.isArray(ev.passed_rules)).toBe(true);
  });

  it('7. POST /api/v1/ui/applications allows eligible student to submit application', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications')
      .set('Authorization', 'Bearer student_STU001')
      .send({
        student_id: 'STU001',
        drive_id: 'DRV001',
        consent: true,
        idempotency_key: `IDEM-${Date.now()}`
      })
      .expect(201);

    expect(res.body.data.application_id).toBeDefined();
  });

  it('8. POST /api/v1/ui/applications fails if consent is missing', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications')
      .set('Authorization', 'Bearer student_STU001')
      .send({
        student_id: 'STU001',
        drive_id: 'DRV001',
        consent: false
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('9. POST /api/v1/ui/applications rejects application without student_id or drive_id', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications')
      .set('Authorization', 'Bearer student_STU001')
      .send({ consent: true })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('10. Duplicate application with same Idempotency-Key returns cached response safely', async () => {
    const key = `IDEM-DUP-${Date.now()}`;

    const res1 = await request(app)
      .post('/api/v1/ui/applications')
      .set('Authorization', 'Bearer student_STU001')
      .send({
        student_id: 'STU001',
        drive_id: 'DRV001',
        consent: true,
        idempotency_key: key
      })
      .expect(201);

    const res2 = await request(app)
      .post('/api/v1/ui/applications')
      .set('Authorization', 'Bearer student_STU001')
      .send({
        student_id: 'STU001',
        drive_id: 'DRV001',
        consent: true,
        idempotency_key: key
      });

    expect([200, 201]).toContain(res2.status);
    expect(res2.body.data.application_id).toBe(res1.body.data.application_id);
  });

  it('11. Student attempting to submit application for another student returns 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications')
      .set('Authorization', 'Bearer student_STU001')
      .send({
        student_id: 'STU002',
        drive_id: 'DRV001',
        consent: true
      })
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('12. Unauthenticated application submission returns 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications')
      .send({
        student_id: 'STU001',
        drive_id: 'DRV001',
        consent: true
      })
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('13. GET /api/v1/ui/drives/DRV999 returns 404 Not Found for non-existent drive', async () => {
    const res = await request(app)
      .get('/api/v1/ui/drives/DRV999')
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('14. GET /api/v1/ui/eligibility/check/DRV999 returns 404 Not Found for missing drive', async () => {
    const res = await request(app)
      .get('/api/v1/ui/eligibility/check/DRV999?student_id=STU001')
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('15. GET /api/v1/ui/eligibility/check/DRV001 returns 404 Not Found for missing student', async () => {
    const res = await request(app)
      .get('/api/v1/ui/eligibility/check/DRV001?student_id=STU999')
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
