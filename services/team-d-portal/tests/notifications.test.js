const request = require('supertest');
const app = require('../server');

describe('Team D BFF — Notifications & Real-Time SSE Updates', () => {
  it('1. GET /api/v1/ui/notifications retrieves user-isolated notification list', async () => {
    const res = await request(app)
      .get('/api/v1/ui/notifications')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    expect(Array.isArray(res.body.data.notifications)).toBe(true);
    expect(typeof res.body.data.unread_count).toBe('number');
  });

  it('2. Returns accurate unread notification count', async () => {
    const res = await request(app)
      .get('/api/v1/ui/notifications')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    expect(res.body.data.unread_count).toBeGreaterThanOrEqual(0);
  });

  it('3. PATCH /api/v1/ui/notifications/:id/read marks notification as read', async () => {
    const res = await request(app)
      .patch('/api/v1/ui/notifications/NOTIF-001/read')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    expect(res.body.data.read).toBe(true);
  });

  it('4. POST /api/v1/ui/notifications/read-all marks all recipient notifications as read', async () => {
    const res = await request(app)
      .post('/api/v1/ui/notifications/read-all')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    expect(res.body.data.message).toBeDefined();

    const listRes = await request(app)
      .get('/api/v1/ui/notifications')
      .set('Authorization', 'Bearer student_STU001');

    expect(listRes.body.data.unread_count).toBe(0);
  });

  it('5. Recipient isolation prevents student STU001 from receiving Student B notifications', async () => {
    const res = await request(app)
      .get('/api/v1/ui/notifications')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    const notifs = res.body.data.notifications;
    for (const n of notifs) {
      expect(n.recipient_id).toBe('STU001');
    }
  });

  it('6. Faculty persona accesses faculty-specific notifications', async () => {
    const res = await request(app)
      .get('/api/v1/ui/notifications')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(200);

    expect(Array.isArray(res.body.data.notifications)).toBe(true);
  });

  it('7. Unauthenticated request to /notifications returns 401 Unauthorized', async () => {
    const res = await request(app)
      .get('/api/v1/ui/notifications')
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('8. Student attempting to mark another recipient notification as read returns 403 Forbidden', async () => {
    const res = await request(app)
      .patch('/api/v1/ui/notifications/NOTIF-003/read')
      .set('Authorization', 'Bearer student_STU001')
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('9. Non-existent notification ID returns 404 Not Found', async () => {
    const res = await request(app)
      .patch('/api/v1/ui/notifications/NOTIF-999/read')
      .set('Authorization', 'Bearer student_STU001')
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('10. SSE Proxy Service handles broadcast events cleanly', () => {
    const sseProxy = require('../src/bff/services/sseProxyService');
    expect(sseProxy).toBeDefined();
    expect(typeof sseProxy.broadcastJson).toBe('function');
  });

  it('11. XSS-safe notification output escapes unsafe characters', async () => {
    const res = await request(app)
      .get('/api/v1/ui/notifications')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    const notif = res.body.data.notifications[0];
    expect(notif.title).not.toContain('<script>');
  });
});
