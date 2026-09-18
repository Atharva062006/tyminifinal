const request = require('supertest');
const app = require('../server');

describe('Team D BFF — Placement Lifecycle, Interviews & Offer Management', () => {
  it('1. Student views own applications list', async () => {
    const res = await request(app)
      .get('/api/v1/ui/applications')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0].student_id).toBe('STU001');
    }
  });

  it('2. Student attempting to view another student application details returns 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/ui/applications/APP-002')
      .set('Authorization', 'Bearer student_STU001')
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('3. Faculty views applicants list', async () => {
    const res = await request(app)
      .get('/api/v1/ui/applications')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('4. Admin views applicants list', async () => {
    const res = await request(app)
      .get('/api/v1/ui/applications')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('5. Faculty shortlists an applicant successfully', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications/APP-001/shortlist')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(200);

    expect(res.body.data.state).toBe('SHORTLISTED');
  });

  it('6. Student attempting shortlist returns 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications/APP-001/shortlist')
      .set('Authorization', 'Bearer student_STU001')
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('7. Schedule interview for application', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications/APP-001/interviews')
      .set('Authorization', 'Bearer faculty_FAC001')
      .send({
        round_name: 'Technical Round 1',
        mode: 'Online',
        location_url: 'https://meet.jit.si/rit-interview'
      })
      .expect(201);

    expect(res.body.data.interview_id).toBeDefined();
    expect(res.body.data.round_name).toBe('Technical Round 1');
  });

  it('8. Student attempting to schedule interview returns 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications/APP-001/interviews')
      .set('Authorization', 'Bearer student_STU001')
      .send({ round_name: 'Hacking Round' })
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('9. Faculty issues formal offer to candidate', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications/APP-001/offer')
      .set('Authorization', 'Bearer admin_ADM001')
      .send({ package_ctc: 800000, joining_date: '2026-07-01' })
      .expect(201);

    expect(res.body.data.offer_id).toBeDefined();
    expect(res.body.data.package_ctc).toBe(800000);
  });

  it('10. Student attempting to issue offer returns 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications/APP-001/offer')
      .set('Authorization', 'Bearer student_STU001')
      .send({ package_ctc: 1200000 })
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('11. Student accepts own offer successfully', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications/APP-001/offer-decision')
      .set('Authorization', 'Bearer student_STU001')
      .send({ decision: 'ACCEPT' })
      .expect(200);

    expect(res.body.data.state).toBe('OFFER_ACCEPTED');
  });

  it('12. Student declines own offer successfully', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications/APP-001/offer-decision')
      .set('Authorization', 'Bearer student_STU001')
      .send({ decision: 'DECLINE' })
      .expect(200);

    expect(res.body.data.state).toBe('OFFER_DECLINED');
  });

  it('13. Student attempting offer decision for another student returns 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications/APP-002/offer-decision')
      .set('Authorization', 'Bearer student_STU001')
      .send({ decision: 'ACCEPT' })
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('14. Unauthenticated offer decision returns 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications/APP-001/offer-decision')
      .send({ decision: 'ACCEPT' })
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
