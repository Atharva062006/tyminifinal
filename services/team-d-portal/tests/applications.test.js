const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const app = require('../server');

describe('Team D BFF — Applications Workflow API', () => {
  it('POST /api/v1/ui/applications requires consent', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications')
      .set('Authorization', 'Bearer student_STU001')
      .send({
        student_id: 'STU001',
        drive_id: 'DRV001',
        consent: false
      })
      .expect(400);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/ui/applications prevents student from applying for another student', async () => {
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

  it('GET /api/v1/ui/applications returns list of applications for student', async () => {
    const res = await request(app)
      .get('/api/v1/ui/applications')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
