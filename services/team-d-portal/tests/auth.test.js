const request = require('supertest');
const app = require('../server');

describe('Team D BFF — Authentication & RBAC', () => {
  it('POST /api/v1/ui/session should authenticate Student persona', async () => {
    const res = await request(app)
      .post('/api/v1/ui/session')
      .send({ role: 'student', user_id: 'STU001' })
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.token).toBe('Bearer student_STU001');
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.permissions).toContain('apply');
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  it('POST /api/v1/ui/session should authenticate Faculty / TPO persona', async () => {
    const res = await request(app)
      .post('/api/v1/ui/session')
      .send({ role: 'faculty', user_id: 'FAC001' })
      .expect(200);

    expect(res.body.data.token).toBe('Bearer faculty_FAC001');
    expect(res.body.data.user.role).toBe('faculty');
    expect(res.body.data.permissions).toContain('view_analytics');
  });

  it('POST /api/v1/ui/session should authenticate Placement Admin persona', async () => {
    const res = await request(app)
      .post('/api/v1/ui/session')
      .send({ role: 'admin', user_id: 'ADM001' })
      .expect(200);

    expect(res.body.data.token).toBe('Bearer admin_ADM001');
    expect(res.body.data.user.role).toBe('admin');
    expect(res.body.data.permissions).toContain('manage_drives');
    expect(res.body.data.permissions).toContain('view_audit');
  });

  it('GET /api/v1/ui/me requires Authorization header', async () => {
    const res = await request(app)
      .get('/api/v1/ui/me')
      .expect(401);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/ui/me returns user profile with valid Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/ui/me')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    expect(res.body.data.user.id).toBe('STU001');
    expect(res.body.data.user.role).toBe('student');
  });

  it('DELETE /api/v1/ui/session successfully logs out', async () => {
    const res = await request(app)
      .delete('/api/v1/ui/session')
      .expect(200);

    expect(res.body.data.message).toBeDefined();
  });
});
