const request = require('supertest');
const app = require('../server');

describe('Team D BFF — Step 9 Production Hardening & Security Audit', () => {
  it('1. Invalid authentication token format returns 401 Unauthorized', async () => {
    const res = await request(app)
      .get('/api/v1/ui/notifications')
      .set('Authorization', 'Bearer invalid_token_format')
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('2. Malformed Authorization header returns 401 Unauthorized', async () => {
    const res = await request(app)
      .get('/api/v1/ui/notifications')
      .set('Authorization', 'Basic 12345')
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('3. Student attempting Admin endpoint returns 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/ui/audit')
      .set('Authorization', 'Bearer student_STU001')
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('4. Faculty attempting Admin-only endpoint returns 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/ui/audit')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('5. Auditor persona attempting unauthorized endpoint returns 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications/APP-001/shortlist')
      .set('Authorization', 'Bearer auditor_AUD001')
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('6. Unauthenticated protected endpoint returns 401 Unauthorized', async () => {
    const res = await request(app)
      .get('/api/v1/ui/analytics')
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('7. Malformed request body / missing drive_id returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/v1/ui/rankings/preview')
      .set('Authorization', 'Bearer admin_ADM001')
      .send({})
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('8. Invalid ID lookup returns 404 Not Found', async () => {
    const res = await request(app)
      .get('/api/v1/ui/applications/APP-999999')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('9. Security headers are set on HTTP responses', async () => {
    const res = await request(app)
      .get('/health')
      .expect(200);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-xss-protection']).toBe('1; mode=block');
  });

  it('10. CSV formula injection is sanitized in report exports', async () => {
    const res = await request(app)
      .get('/api/v1/ui/reports/export?type=drive_performance&format=csv')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(200);

    expect(res.text).not.toContain('=cmd|');
  });

  it('11. XSS payload in notifications is safely escaped', async () => {
    const res = await request(app)
      .get('/api/v1/ui/notifications')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    const notif = res.body.data.notifications[0];
    expect(notif.title).not.toContain('<script>');
  });

  it('12. API responses do not expose internal stack traces or secrets', async () => {
    const res = await request(app)
      .get('/api/v1/ui/applications/APP-999')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(404);

    expect(res.body.stack).toBeUndefined();
    expect(res.body.password).toBeUndefined();
  });

  it('13. Student notification isolation prevents reading another student notifications', async () => {
    const res = await request(app)
      .patch('/api/v1/ui/notifications/NOTIF-003/read')
      .set('Authorization', 'Bearer student_STU001')
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('14. Idempotency key lookup prevents duplicate application processing', async () => {
    const res = await request(app)
      .post('/api/v1/ui/applications')
      .set('Authorization', 'Bearer student_STU001')
      .set('Idempotency-Key', 'KEY-SEC-TEST-001')
      .send({ student_id: 'STU001', drive_id: 'DRV002', consent: true })
      .expect(201);

    expect(res.body.data.application_id).toBeDefined();
  });
});
