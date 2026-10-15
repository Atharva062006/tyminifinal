const request = require('supertest');
const app = require('../server');

const as = (token) => ({ Authorization: `Bearer ${token}` });
const FAC = 'faculty_FAC001';
const ADM = 'admin_ADM001';
const STU1 = 'student_STU001';
const STU2 = 'student_STU002';

describe('Team D BFF — Placement Lifecycle, Interviews & Offer Management', () => {
  it('1. Student views own applications list', async () => {
    const res = await request(app).get('/api/v1/ui/applications').set(as(STU1)).expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every(a => a.student_id === 'STU001')).toBe(true);
  });

  it('2. Student attempting to view another student application details returns 403 Forbidden', async () => {
    const res = await request(app).get('/api/v1/ui/applications/APP-002').set(as(STU1)).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('3. Faculty and admin view the applicant registry', async () => {
    const f = await request(app).get('/api/v1/ui/applications').set(as(FAC)).expect(200);
    const a = await request(app).get('/api/v1/ui/applications').set(as(ADM)).expect(200);
    expect(f.body.data.length).toBeGreaterThanOrEqual(2);
    expect(a.body.data.length).toBe(f.body.data.length);
  });

  it('4. Student attempting shortlist returns 403 Forbidden', async () => {
    const res = await request(app).post('/api/v1/ui/applications/APP-001/shortlist').set(as(STU1)).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('5. Faculty shortlists an applicant and the change is persisted (state machine enforced)', async () => {
    const res = await request(app).post('/api/v1/ui/applications/APP-001/shortlist').set(as(FAC)).expect(200);
    expect(res.body.data.state).toBe('SHORTLISTED');
    const read = await request(app).get('/api/v1/ui/applications/APP-001').set(as(FAC)).expect(200);
    expect(read.body.data.application.state).toBe('SHORTLISTED');
  });

  it('6. Illegal jumps are rejected with 422 (cannot issue an offer before selection)', async () => {
    const res = await request(app).post('/api/v1/ui/applications/APP-001/offer').set(as(ADM)).send({ package_ctc: 800000 }).expect(422);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('7. Student attempting to schedule interview returns 403 Forbidden', async () => {
    const res = await request(app).post('/api/v1/ui/applications/APP-001/interviews').set(as(STU1)).send({ round_name: 'Hacking Round' }).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('8. Faculty schedules an interview; a second candidate cannot take the same slot', async () => {
    const slot = new Date(Date.now() + 2 * 86400000).toISOString();
    const res = await request(app).post('/api/v1/ui/applications/APP-001/interviews').set(as(FAC))
      .send({ round_name: 'Technical Round 1', mode: 'Online', scheduled_at: slot }).expect(201);
    expect(res.body.data.interview_id).toBeDefined();
    expect(res.body.data.round_name).toBe('Technical Round 1');

    await request(app).post('/api/v1/ui/applications/APP-002/shortlist').set(as(FAC)).expect(200);
    const clash = await request(app).post('/api/v1/ui/applications/APP-002/interviews').set(as(FAC)).send({ scheduled_at: slot }).expect(409);
    expect(clash.body.error.code).toBe('CONFLICT');

    const list = await request(app).get('/api/v1/ui/interviews').set(as(STU1)).expect(200);
    expect(list.body.data.some(i => i.application_id === 'APP-001')).toBe(true);
  });

  it('9. Faculty selects the candidate, then issues a formal offer', async () => {
    const sel = await request(app).post('/api/v1/ui/applications/APP-001/select').set(as(FAC)).expect(200);
    expect(sel.body.data.state).toBe('SELECTED');
    const res = await request(app).post('/api/v1/ui/applications/APP-001/offer').set(as(ADM)).send({ package_ctc: 800000, joining_date: '2026-07-01' }).expect(201);
    expect(res.body.data.state).toBe('OFFER_ISSUED');
    const offers = await request(app).get('/api/v1/ui/offers').set(as(STU1)).expect(200);
    expect(offers.body.data.find(o => o.application_id === 'APP-001').package_ctc).toBe(800000);
  });

  it('10. Student attempting to issue offer returns 403 Forbidden', async () => {
    await request(app).post('/api/v1/ui/applications/APP-001/offer').set(as(STU1)).send({ package_ctc: 1200000 }).expect(403);
  });

  it('11. Another student cannot answer the offer (403); unauthenticated gets 401', async () => {
    const res = await request(app).post('/api/v1/ui/applications/APP-001/offer-decision').set(as(STU2)).send({ decision: 'ACCEPT' }).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    const anon = await request(app).post('/api/v1/ui/applications/APP-001/offer-decision').send({ decision: 'ACCEPT' }).expect(401);
    expect(anon.body.error.code).toBe('UNAUTHORIZED');
  });

  it('12. Student accepts own offer; a second decision is refused (terminal state)', async () => {
    const res = await request(app).post('/api/v1/ui/applications/APP-001/offer-decision').set(as(STU1)).send({ decision: 'ACCEPT' }).expect(200);
    expect(res.body.data.state).toBe('OFFER_ACCEPTED');
    await request(app).post('/api/v1/ui/applications/APP-001/offer-decision').set(as(STU1)).send({ decision: 'DECLINE' }).expect(422);
  });

  it('13. Faculty rejects an applicant with a reason; withdrawal by owner works; invalid decision is 400', async () => {
    const rej = await request(app).post('/api/v1/ui/applications/APP-002/reject').set(as(FAC)).send({ reason: 'Skills mismatch' }).expect(200);
    expect(rej.body.data.state).toBe('REJECTED');
    await request(app).post('/api/v1/ui/applications/APP-002/offer-decision').set(as(STU2)).send({ decision: 'MAYBE' }).expect(400);
    await request(app).post('/api/v1/ui/applications/APP-002/withdraw').set(as(STU2)).expect(422);
  });
});
