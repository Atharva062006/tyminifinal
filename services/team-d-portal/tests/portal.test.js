const request = require('supertest');
const app = require('../server');

describe('Team D BFF — Management Portal (Faculty, TPO, Admin) & RBAC', () => {
  it('1. Faculty dashboard returns aggregated operational metrics', async () => {
    const res = await request(app)
      .get('/api/v1/ui/dashboard')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(200);

    expect(res.body.data.role).toBe('faculty');
    expect(res.body.data.kpis).toBeDefined();
    expect(res.body.data.drives_summary).toBeDefined();
  });

  it('2. Admin dashboard returns full system health and audit logs', async () => {
    const res = await request(app)
      .get('/api/v1/ui/dashboard')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(200);

    expect(res.body.data.role).toBe('admin');
    expect(res.body.data.system_health).toBeDefined();
    expect(res.body.data.recent_audit_events).toBeDefined();
  });

  it('3. Student attempting to access Faculty performance reports returns 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/ui/reports/placement-performance')
      .set('Authorization', 'Bearer student_STU001')
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('4. Student attempting to access Admin audit logs returns 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/ui/audit')
      .set('Authorization', 'Bearer student_STU001')
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('5. Faculty attempting access to Admin-only audit logs returns 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/ui/audit')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('6. Authorized Faculty can view complete applicants list', async () => {
    const res = await request(app)
      .get('/api/v1/ui/applications')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('7. Authorized Admin can view complete applicants list', async () => {
    const res = await request(app)
      .get('/api/v1/ui/applications')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('8. Authorized Admin/Faculty can modify placement drive details', async () => {
    const res = await request(app)
      .patch('/api/v1/ui/drives/DRV001')
      .set('Authorization', 'Bearer admin_ADM001')
      .send({ title: 'SDE Intern 2026 Updated' })
      .expect(200);

    expect(res.body.data).toBeDefined();
  });

  it('9. Student attempting to modify placement drive returns 403 Forbidden', async () => {
    const res = await request(app)
      .patch('/api/v1/ui/drives/DRV001')
      .set('Authorization', 'Bearer student_STU001')
      .send({ title: 'Hacked Title' })
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('10. Authorized Admin/Auditor can query audit log entries', async () => {
    const res = await request(app)
      .get('/api/v1/ui/audit')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(200);

    expect(res.body.data).toBeDefined();
  });

  it('11. System health check returns status for Team A, B, C, D microservices', async () => {
    const res = await request(app)
      .get('/api/v1/ui/system')
      .expect(200);

    expect(res.body.data.gateway.status).toBe('ONLINE');
    expect(Array.isArray(res.body.data.services)).toBe(true);
  });

  it('12. Unauthenticated access to protected management APIs returns 401 Unauthorized', async () => {
    const res = await request(app)
      .get('/api/v1/ui/audit')
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
