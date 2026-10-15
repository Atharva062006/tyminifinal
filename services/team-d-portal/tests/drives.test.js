const request = require('supertest');
const app = require('../server');

describe('Team D BFF — Drives & Eligibility API', () => {
  it('GET /api/v1/ui/drives should list drives with company information', async () => {
    const res = await request(app)
      .get('/api/v1/ui/drives')
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      const drive = res.body.data[0];
      expect(drive.drive_id).toBeDefined();
      expect(drive.title).toBeDefined();
    }
  });

  it('GET /api/v1/ui/eligibility/check/:driveId evaluates student eligibility via Team A', async () => {
    const drivesRes = await request(app).get('/api/v1/ui/drives');
    if (drivesRes.body.data.length > 0) {
      const driveId = drivesRes.body.data[0].drive_id;
      const res = await request(app)
        .get(`/api/v1/ui/eligibility/check/${driveId}?student_id=STU001`)
        .set('Authorization', 'Bearer student_STU001')
        .expect(200);

      expect(res.body.data.evaluation).toBeDefined();
      expect(res.body.data.evaluation.eligibility_result).toBeDefined();
      expect(['ELIGIBLE', 'CONDITIONAL', 'NOT_ELIGIBLE']).toContain(res.body.data.evaluation.eligibility_result);
    }
  });

  it('PATCH /api/v1/ui/drives/:driveId requires Admin or Faculty role', async () => {
    const res = await request(app)
      .patch('/api/v1/ui/drives/DRV001')
      .set('Authorization', 'Bearer student_STU001')
      .send({ seats: 15 })
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
