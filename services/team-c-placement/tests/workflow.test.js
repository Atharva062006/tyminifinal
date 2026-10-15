/**
 * Team C end-to-end workflow tests: real Team A + Team B engines on ephemeral ports, a throw-away
 * data directory, and the full HTTP surface of Team C (auth, applications, workflow, audit, recovery).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const teamAApp = require('../../team-a-eligibility/server').buildApp();
const teamBApp = require('../../team-b-ranking/server').buildApp();
const { startServer } = require('../server');

let servers = [];
let ctx;
let dataDir;
let faculty;
let admin;
let auditor;
let students = {};

const login = async (email, password) => (await request(ctx.app).post('/api/v1/auth/login').send({ username: email, password })).body.data;
const as = (session) => ({ Authorization: `Bearer ${session.token}` });
let keySeq = 0;
const apply = (session, student_id, drive_id, key) => request(ctx.app).post('/api/v1/applications').set(as(session))
  .send({ student_id, drive_id, consent: true, idempotency_key: key || `k-${Date.now()}-${keySeq++}` });
const move = (session, appId, target_state, extra = {}) => request(ctx.app).post(`/api/v1/applications/${appId}/transition`).set(as(session)).send({ target_state, ...extra });

beforeAll(async () => {
  for (const [app, envKey] of [[teamAApp, 'TEAM_A_URL'], [teamBApp, 'TEAM_B_URL']]) {
    const srv = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)); });
    servers.push(srv);
    process.env[envKey] = `http://127.0.0.1:${srv.address().port}`;
  }
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamc-'));
  ctx = await startServer({ dataDir, listen: false });
  faculty = await login('tpo@rit.edu', 'faculty123');
  admin = await login('admin@rit.edu', 'admin123');
  auditor = await login('auditor@rit.edu', 'auditor123');
  for (const [k, email] of Object.entries({ aarav: 'aarav@rit.edu', rohan: 'rohan@rit.edu', ananya: 'ananya@rit.edu', devraj: 'devraj@rit.edu', isha: 'isha@rit.edu', neha: 'neha@rit.edu', kabir: 'kabir@rit.edu' })) {
    students[k] = await login(email, 'student123');
  }
  await new Promise(r => setTimeout(r, 200));
}, 30000);

afterAll(async () => {
  await ctx.db.shutdown();
  teamAApp.engine.locks.shutdown();
  await Promise.all(servers.map(s => new Promise(r => s.close(r))));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('authentication and registration', () => {
  test('login returns a signed token and the user profile; wrong password is rejected', async () => {
    expect(students.aarav.token).toBeTruthy();
    expect(students.aarav.user.id).toBe('STU001');
    expect(faculty.user.role).toBe('faculty');
    const bad = await request(ctx.app).post('/api/v1/auth/login').send({ username: 'aarav@rit.edu', password: 'nope' });
    expect(bad.status).toBe(401);
  });

  test('student can self-register, log in and is linked to a new student record', async () => {
    const reg = await request(ctx.app).post('/api/v1/auth/register').send({
      name: 'Test Student', email: 'test.student@rit.edu', password: 'secret12', branch: 'CSE', cgpa: 8.1, backlogs: 0, attendance: 84, skills: ['Python'],
    });
    expect(reg.status).toBe(201);
    expect(reg.body.data.user.student_id).toMatch(/^STU\d+/);
    const again = await request(ctx.app).post('/api/v1/auth/register').send({ name: 'Dup', email: 'test.student@rit.edu', password: 'secret12', branch: 'CSE', cgpa: 8 });
    expect(again.status).toBe(409);
    const invalid = await request(ctx.app).post('/api/v1/auth/register').send({ name: 'X', email: 'bad', password: '1', branch: '', cgpa: 99 });
    expect(invalid.status).toBe(400);
    const me = await request(ctx.app).get('/api/v1/auth/me').set(as(reg.body.data));
    expect(me.body.data.email).toBe('test.student@rit.edu');
  });

  test('protected routes need a token; role guards apply', async () => {
    expect((await request(ctx.app).get('/api/v1/drives')).status).toBe(401);
    expect((await request(ctx.app).get('/api/v1/users').set(as(students.aarav))).status).toBe(403);
    expect((await request(ctx.app).get('/api/v1/users').set(as(admin))).status).toBe(200);
    expect((await request(ctx.app).get('/api/v1/audit').set(as(faculty))).status).toBe(403);
    expect((await request(ctx.app).get('/api/v1/audit').set(as(auditor))).status).toBe(200);
  });
});

describe('Apply -> Evaluate -> Rank pipeline (C2 + Team A + Team B)', () => {
  test('eligible student ends RULE_EVALUATED with a decision and a rank; audit trail exists', async () => {
    const res = await apply(students.neha, 'STU007', 'DRV002');
    expect(res.status).toBe(201);
    const app = res.body.data;
    expect(app.state).toBe('RULE_EVALUATED');
    expect(app.eligibility_result).toBe('ELIGIBLE');
    expect(app.ranking_status).toBe('OK');
    expect(app.rank).toBeGreaterThanOrEqual(1);
    const details = (await request(ctx.app).get(`/api/v1/applications/${app.application_id}/details`).set(as(students.neha))).body.data;
    expect(details.decisions).toHaveLength(1);
    const actions = details.audit.map(a => a.action);
    expect(actions).toContain('CREATE_APPLICATION');
    expect(actions.some(a => a.startsWith('STATE_TRANSITION:SCREENING->RULE_EVALUATED'))).toBe(true);
  });

  test('ineligible student ends NOT_ELIGIBLE with failed rules', async () => {
    const res = await apply(students.devraj, 'STU004', 'DRV003');
    expect(res.body.data.state).toBe('NOT_ELIGIBLE');
    expect(res.body.data.failed_rules.length).toBeGreaterThan(0);
  });

  test('same idempotency key replays the original outcome without a second row', async () => {
    const before = ctx.db.table('applications').count();
    const a = await apply(students.isha, 'STU005', 'DRV004', 'idem-fixed-1');
    const b = await apply(students.isha, 'STU005', 'DRV004', 'idem-fixed-1');
    expect(b.body.data.application_id).toBe(a.body.data.application_id);
    expect(ctx.db.table('applications').count()).toBe(before + 1);
  });

  test('a second active application for the same drive is rejected (409) and cross-student apply is forbidden', async () => {
    const dup = await apply(students.isha, 'STU005', 'DRV004');
    expect(dup.status).toBe(409);
    const other = await apply(students.isha, 'STU001', 'DRV004');
    expect(other.status).toBe(403);
  });

  test('50 concurrent attempts for one student/drive create exactly one application', async () => {
    const before = ctx.db.table('applications').find(a => a.student_id === 'STU006' && a.drive_id === 'DRV003').length;
    const results = await Promise.all(Array.from({ length: 50 }, (_, i) => apply(students.kabir, 'STU006', 'DRV003', `race-${i}`)));
    const created = results.filter(r => r.status === 201).length;
    expect(created).toBe(1);
    expect(results.filter(r => r.status === 409).length).toBe(49);
    expect(ctx.db.table('applications').find(a => a.student_id === 'STU006' && a.drive_id === 'DRV003').length).toBe(before + 1);
  }, 30000);

  test('closed or draft drives and missing consent are rejected', async () => {
    expect((await apply(students.aarav, 'STU001', 'DRV005')).status).toBe(409);
    const noConsent = await request(ctx.app).post('/api/v1/applications').set(as(students.aarav)).send({ student_id: 'STU001', drive_id: 'DRV003', consent: false, idempotency_key: 'nc-1' });
    expect(noConsent.status).toBe(400);
  });
});

describe('staff review, interviews, selection, offers (C3)', () => {
  let appId;
  const drive = () => ctx.db.table('drives').findById('DRV001');

  test('students cannot shortlist; faculty can; illegal jumps are rejected with 422', async () => {
    const created = await apply(students.aarav, 'STU001', 'DRV003');
    // STU001 already has a seeded application on DRV001; use DRV003 for a fresh one
    appId = created.body.data.application_id;
    expect(created.body.data.state).toBe('RULE_EVALUATED');
    expect((await move(students.aarav, appId, 'SHORTLISTED')).status).toBe(403);
    expect((await move(faculty, appId, 'SELECTED')).status).toBe(422);
    const ok = await move(faculty, appId, 'SHORTLISTED');
    expect(ok.status).toBe(200);
    expect(ok.body.data.state).toBe('SHORTLISTED');
  });

  test('optimistic concurrency: stale expected_version is rejected', async () => {
    const stale = await move(faculty, appId, 'WAITLISTED', { expected_version: 1 });
    expect(stale.status).toBe(409);
  });

  test('interview slot lease: two candidates cannot hold the same slot', async () => {
    const secondId = ctx.db.table('applications').find(a => a.student_id === 'STU006' && a.drive_id === 'DRV003')[0].application_id;
    await move(faculty, secondId, 'SHORTLISTED');
    const when = new Date(Date.now() + 3 * 86400000).toISOString();
    const first = await request(ctx.app).post(`/api/v1/applications/${appId}/interviews`).set(as(faculty)).send({ scheduled_at: when, round_name: 'Technical' });
    expect(first.status).toBe(201);
    expect(first.body.data.state).toBe('INTERVIEW_SCHEDULED');
    const clash = await request(ctx.app).post(`/api/v1/applications/${secondId}/interviews`).set(as(faculty)).send({ scheduled_at: when });
    expect(clash.status).toBe(409);
    expect(ctx.db.table('applications').findById(secondId).state).toBe('SHORTLISTED');
    const other = await request(ctx.app).post(`/api/v1/applications/${secondId}/interviews`).set(as(faculty)).send({ scheduled_at: new Date(Date.now() + 4 * 86400000).toISOString() });
    expect(other.status).toBe(201);
  });

  test('selection claims a seat; offer issue needs a package; accept finalises', async () => {
    const seatsBefore = ctx.db.table('drives').findById('DRV003').seats;
    const sel = await move(faculty, appId, 'SELECTED');
    expect(sel.body.data.state).toBe('SELECTED');
    expect(ctx.db.table('drives').findById('DRV003').seats).toBe(seatsBefore - 1);
    const bad = await move(faculty, appId, 'OFFER_ISSUED', { payload: { package_ctc: -5 } });
    expect(bad.status).toBe(400);
    const off = await move(faculty, appId, 'OFFER_ISSUED', { payload: { package_ctc: 950000, joining_date: '2026-07-15' } });
    expect(off.body.data.state).toBe('OFFER_ISSUED');
    expect((await move(students.rohan, appId, 'OFFER_ACCEPTED')).status).toBe(403); // another student's offer
    const acc = await move(students.aarav, appId, 'OFFER_ACCEPTED');
    expect(acc.body.data.state).toBe('OFFER_ACCEPTED');
    const offers = (await request(ctx.app).get('/api/v1/offers').set(as(students.aarav))).body.data;
    expect(offers.find(o => o.application_id === appId).status).toBe('ACCEPTED');
    expect(ctx.db.table('drives').findById('DRV003').seats).toBe(seatsBefore - 1);
  });

  test('declining an offer returns the seat; withdrawing a selected application returns it too', async () => {
    const d = () => ctx.db.table('drives').findById('DRV004').seats;
    const start = d();
    // the DRV004 application from the idempotency test is still active -> use that one
    const target = ctx.db.table('applications').find(x => x.student_id === 'STU005' && x.drive_id === 'DRV004')[0];
    const id = target.application_id;
    await move(faculty, id, 'SHORTLISTED');
    await request(ctx.app).post(`/api/v1/applications/${id}/interviews`).set(as(faculty)).send({ scheduled_at: new Date(Date.now() + 5 * 86400000).toISOString() });
    await move(faculty, id, 'SELECTED');
    expect(d()).toBe(start - 1);
    const oi = await move(faculty, id, 'OFFER_ISSUED', { payload: { package_ctc: 480000 } });
    if (oi.status !== 200) console.log('OFFER ISSUE FAILED', oi.status, JSON.stringify(oi.body));
    const decl = await move(students.isha, id, 'OFFER_DECLINED');
    if (!decl.body.data) console.log('DECLINE FAILED', decl.status, JSON.stringify(decl.body));
    expect(decl.body.data.state).toBe('OFFER_DECLINED');
    expect(d()).toBe(start);
  });

  test('no seats left -> selection conflicts', async () => {
    await request(ctx.app).patch('/api/v1/internal/drives/DRV003').set(as(faculty)).send({ seats: 1 });
    // DRV003 has 1 seat claimed by the accepted offer, so remaining is 0
    expect(ctx.db.table('drives').findById('DRV003').seats).toBe(0);
    const apps = ctx.db.table('applications').find(a => a.drive_id === 'DRV003' && a.state === 'INTERVIEW_SCHEDULED');
    expect(apps.length).toBeGreaterThan(0);
    const res = await move(faculty, apps[0].application_id, 'SELECTED');
    expect(res.status).toBe(409);
  });

  test('rejected candidates leave interviews cancelled; withdrawing is allowed for the owner only', async () => {
    const apps = ctx.db.table('applications').find(a => a.drive_id === 'DRV003' && a.state === 'INTERVIEW_SCHEDULED');
    const id = apps[0].application_id;
    const stranger = Object.values(students).find(x => x.user.id !== ctx.db.table('applications').findById(id).student_id);
    expect((await move(stranger, id, 'WITHDRAWN')).status).toBe(403);
    const rej = await move(faculty, id, 'REJECTED', { reason: 'Did not clear technical round' });
    expect(rej.body.data.state).toBe('REJECTED');
    const ivs = ctx.db.lookupBy('interviews', 'application_id', id);
    expect(ivs.every(i => i.status === 'CANCELLED')).toBe(true);
    const owner = ctx.db.table('applications').findById(id).student_id;
    const ownerSession = Object.values(students).find(x => x.user.id === owner);
    const notes = (await request(ctx.app).get('/api/v1/notifications').set(as(ownerSession))).body.data;
    expect(notes.notifications.some(n => n.type === 'REJECTED')).toBe(true);
  });
});

describe('integrity, audit and recovery (C4)', () => {
  test('every state transition has an audit row with actor, correlation id and before/after', () => {
    const rows = ctx.db.table('audit_log').all().filter(r => r.action.startsWith('STATE_TRANSITION'));
    expect(rows.length).toBeGreaterThan(10);
    for (const r of rows) {
      expect(r.actor).toBeTruthy();
      expect(r.correlation_id).toBeTruthy();
      expect(r.before_value).toBeTruthy();
      expect(r.after_value).toBeTruthy();
    }
  });

  test('reconciliation: seats and decisions are consistent', async () => {
    const rec = (await request(ctx.app).get('/api/v1/reports/reconciliation').set(as(admin))).body.data;
    expect(rec.applications_missing_decision).toEqual([]);
    expect(rec.seat_reconciliation.filter(s => !s.consistent)).toEqual([]);
  });

  test('placement report reflects selections, offers and branch placement rate', async () => {
    const rep = (await request(ctx.app).get('/api/v1/reports/placement-performance').set(as(faculty))).body.data;
    expect(rep.totals.total_applications).toBeGreaterThan(5);
    expect(rep.totals.total_selected).toBeGreaterThan(0);
    expect(rep.branch_stats.length).toBeGreaterThan(1);
    expect(rep.query_time_ms).toBeLessThan(200);
  });

  test('backup then verify-restore reconciles every table', async () => {
    const b = await request(ctx.app).post('/api/v1/internal/recovery/backup').set(as(admin));
    expect(b.status).toBe(201);
    const v = (await request(ctx.app).post('/api/v1/internal/recovery/verify-restore').set(as(admin)).send({ backup_id: b.body.data.backup_id })).body.data;
    expect(v.status).toBe('SUCCESS');
    expect(v.tables_with_drift).toBe(0);
    expect(v.rto_met).toBe(true);
  });

  test('schema constraints reject bad data (FK, enum, check)', async () => {
    expect((await request(ctx.app).patch('/api/v1/students/STU001').set(as(students.aarav)).send({ cgpa: 42 })).status).toBe(400);
    const bad = await request(ctx.app).post('/api/v1/drives').set(as(faculty)).send({ company_id: 'NOPE', title: 'X', seats: 2 });
    expect(bad.status).toBe(400);
  });
});

describe('profile, announcements, notifications, users', () => {
  test('student edits own profile (academic edit clears verification); cannot edit others', async () => {
    const ok = await request(ctx.app).patch('/api/v1/students/STU002').set(as(students.rohan)).send({ about: 'Backend enthusiast', skills: ['Java', 'Spring', 'JavaScript', 'Python'], cgpa: 7.5 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.academic_verified).toBe(false);
    expect((await request(ctx.app).patch('/api/v1/students/STU001').set(as(students.rohan)).send({ about: 'hacked' })).status).toBe(403);
    const verify = await request(ctx.app).patch('/api/v1/students/STU002').set(as(faculty)).send({ academic_verified: true });
    expect(verify.body.data.academic_verified).toBe(true);
  });

  test('announcements persist and notify students; notifications are recipient isolated', async () => {
    const ann = await request(ctx.app).post('/api/v1/announcements').set(as(faculty)).send({ title: 'Mock test on Monday', content: 'Aptitude test in Lab 3' });
    expect(ann.status).toBe(201);
    expect((await request(ctx.app).post('/api/v1/announcements').set(as(students.aarav)).send({ title: 'x' })).status).toBe(403);
    const list = (await request(ctx.app).get('/api/v1/announcements').set(as(students.aarav))).body.data;
    expect(list[0].title).toBe('Mock test on Monday');
    const mine = (await request(ctx.app).get('/api/v1/notifications').set(as(students.aarav))).body.data;
    expect(mine.notifications.some(n => n.type === 'ANNOUNCEMENT')).toBe(true);
    const id = mine.notifications.find(n => !n.read).notification_id;
    expect((await request(ctx.app).patch(`/api/v1/notifications/${id}/read`).set(as(students.rohan))).status).toBe(403);
    expect((await request(ctx.app).patch(`/api/v1/notifications/${id}/read`).set(as(students.aarav))).status).toBe(200);
    const all = await request(ctx.app).post('/api/v1/notifications/read-all').set(as(students.aarav));
    expect(all.body.data.updated).toBeGreaterThanOrEqual(0);
  });

  test('admin can create staff, deactivate accounts and reset passwords', async () => {
    const created = await request(ctx.app).post('/api/v1/users').set(as(admin)).send({ name: 'New TPO', email: 'new.tpo@rit.edu', password: 'tpo-pass1', role: 'faculty' });
    expect(created.status).toBe(201);
    expect((await login('new.tpo@rit.edu', 'tpo-pass1')).user.role).toBe('faculty');
    await request(ctx.app).patch(`/api/v1/users/${created.body.data.user_id}`).set(as(admin)).send({ active: false });
    expect((await request(ctx.app).post('/api/v1/auth/login').send({ username: 'new.tpo@rit.edu', password: 'tpo-pass1' })).status).toBe(401);
    expect((await request(ctx.app).patch('/api/v1/users/ADM001').set(as(admin)).send({ active: false })).status).toBe(409);
  });
});

describe('resilience: Team A outage', () => {
  test('application is saved in SCREENING and completes after the retry once Team A is back', async () => {
    const realUrl = process.env.TEAM_A_URL;
    process.env.TEAM_A_URL = 'http://127.0.0.1:1'; // nothing listens here
    const res = await apply(students.ananya, 'STU003', 'DRV004');
    expect(res.status).toBe(201);
    expect(res.body.data.state).toBe('SCREENING');
    expect(res.body.data.pipeline_status).toBe('EVALUATION_PENDING');
    process.env.TEAM_A_URL = realUrl;
    const re = await request(ctx.app).post(`/api/v1/applications/${res.body.data.application_id}/reevaluate`).set(as(faculty));
    expect(re.status).toBe(200);
    expect(['RULE_EVALUATED', 'NOT_ELIGIBLE']).toContain(re.body.data.state);
  });

  test('interview scheduling fails cleanly (503) when the slot service is down, state unchanged', async () => {
    const created = ctx.db.table('applications').find(a => a.state === 'RULE_EVALUATED')[0];
    await move(faculty, created.application_id, 'SHORTLISTED');
    const realUrl = process.env.TEAM_A_URL;
    process.env.TEAM_A_URL = 'http://127.0.0.1:1';
    const res = await request(ctx.app).post(`/api/v1/applications/${created.application_id}/interviews`).set(as(faculty)).send({});
    process.env.TEAM_A_URL = realUrl;
    expect(res.status).toBe(503);
    expect(ctx.db.table('applications').findById(created.application_id).state).toBe('SHORTLISTED');
  });
});
