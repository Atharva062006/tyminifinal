const request = require('supertest');
const app = require('../server');

describe('Team D BFF — accounts, registration and administration', () => {
  it('logs in with e-mail + password and returns a bearer token and permissions', async () => {
    const res = await request(app).post('/api/v1/ui/session').send({ username: 'aarav@rit.edu', password: 'student123' }).expect(200);
    expect(res.body.data.token).toMatch(/^Bearer /);
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.auth_mode).toBe('account_login');
    expect(res.body.data.permissions).toContain('edit_profile');
  });

  it('rejects wrong credentials with 401 and missing fields with 400', async () => {
    await request(app).post('/api/v1/ui/session').send({ username: 'aarav@rit.edu', password: 'wrong' }).expect(401);
    const res = await request(app).post('/api/v1/ui/session').send({ username: 'aarav@rit.edu' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('registers a student, signs them in immediately and rejects a duplicate e-mail', async () => {
    const body = { name: 'New Student', email: 'new.student@rit.edu', password: 'secret12', branch: 'CSE', cgpa: 8.1, backlogs: 0 };
    const res = await request(app).post('/api/v1/ui/register').send(body).expect(201);
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.token).toMatch(/^Bearer /);
    const dup = await request(app).post('/api/v1/ui/register').send(body).expect(409);
    expect(dup.body.error.code).toBe('CONFLICT');
  });

  it('tokens signed by Team C verification are required outside dev mode (garbage is refused)', async () => {
    const res = await request(app).get('/api/v1/ui/me').set('Authorization', 'Bearer not-a-real-token.abc').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('only admins can manage users', async () => {
    await request(app).get('/api/v1/ui/users').set('Authorization', 'Bearer faculty_FAC001').expect(403);
    const res = await request(app).get('/api/v1/ui/users').set('Authorization', 'Bearer admin_ADM001').expect(200);
    expect(res.body.data.length).toBeGreaterThan(3);
    const created = await request(app).post('/api/v1/ui/users').set('Authorization', 'Bearer admin_ADM001')
      .send({ name: 'Second TPO', email: 'tpo2@rit.edu', password: 'tpo-pass1', role: 'faculty' }).expect(201);
    await request(app).patch(`/api/v1/ui/users/${created.body.data.user_id}`).set('Authorization', 'Bearer admin_ADM001').send({ active: false }).expect(200);
  });

  it('students cannot read the student directory; staff can; companies and drives can be created by staff only', async () => {
    await request(app).get('/api/v1/ui/students').set('Authorization', 'Bearer student_STU001').expect(403);
    const list = await request(app).get('/api/v1/ui/students').set('Authorization', 'Bearer faculty_FAC001').expect(200);
    expect(list.body.data[0].readiness_score).toBeDefined();
    await request(app).post('/api/v1/ui/companies').set('Authorization', 'Bearer student_STU001').send({ name: 'X' }).expect(403);
    const co = await request(app).post('/api/v1/ui/companies').set('Authorization', 'Bearer faculty_FAC001').send({ name: 'Acme Robotics' }).expect(201);
    const dr = await request(app).post('/api/v1/ui/drives').set('Authorization', 'Bearer faculty_FAC001')
      .send({ company_id: co.body.data.company_id, title: 'Robotics Trainee', seats: 3, package: 500000 }).expect(201);
    expect(dr.body.data.drive_id).toBeDefined();
    await request(app).post('/api/v1/ui/drives').set('Authorization', 'Bearer faculty_FAC001').send({ company_id: co.body.data.company_id, title: 'Bad', seats: 0 }).expect(400);
  });

  it('announcements: staff can publish and delete, students cannot', async () => {
    await request(app).post('/api/v1/ui/announcements').set('Authorization', 'Bearer student_STU001').send({ title: 'x' }).expect(403);
    const a = await request(app).post('/api/v1/ui/announcements').set('Authorization', 'Bearer faculty_FAC001').send({ title: 'Mock test', content: 'Lab 3' }).expect(201);
    await request(app).delete(`/api/v1/ui/announcements/${a.body.data.announcement_id}`).set('Authorization', 'Bearer faculty_FAC001').expect(200);
  });

  it('unknown API routes answer JSON 404 (never the SPA shell)', async () => {
    const res = await request(app).get('/api/v1/ui/does-not-exist').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('interviews and offers lists are role-scoped', async () => {
    const mine = await request(app).get('/api/v1/ui/interviews').set('Authorization', 'Bearer student_STU001').expect(200);
    expect(mine.body.data.every(i => i.student_id === 'STU001')).toBe(true);
    await request(app).get('/api/v1/ui/offers').set('Authorization', 'Bearer student_STU001').expect(200);
  });
});
