const request = require('supertest');
const app = require('../server');

describe('Team D BFF — Centralized Error Handling & Envelopes', () => {
  it('Returns standard error envelope with X-Correlation-ID for 404', async () => {
    const res = await request(app)
      .get('/api/v1/ui/drives/non-existent-drive-id-999')
      .expect(404);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.meta.correlation_id).toBeDefined();
  });

  it('Returns 400 Validation Error for missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications')
      .set('Authorization', 'Bearer student_STU001')
      .send({})
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/ui/system returns status of all 4 microservices', async () => {
    const res = await request(app)
      .get('/api/v1/ui/system')
      .expect(200);

    expect(res.body.data.services).toBeDefined();
    expect(res.body.data.services.length).toBe(4);
    expect(res.body.data.gateway.service).toBe('team-d-portal');
  });
});
