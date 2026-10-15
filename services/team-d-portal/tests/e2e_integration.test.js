const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const app = require('../server');

describe('Team D BFF — Full End-to-End Workflow Integration', () => {
  it('Executes full Apply → Evaluate → Rank → Trace → Audit E2E Flow', async () => {
    const correlationId = uuidv4();
    const idempotencyKey = uuidv4();

    // 1. Student Login
    const loginRes = await request(app)
      .post('/api/v1/ui/session')
      .set('X-Correlation-ID', correlationId)
      .send({ role: 'student', user_id: 'STU001' })
      .expect(200);

    const token = loginRes.body.data.token;
    expect(token).toBe('Bearer student_STU001');

    // 2. Discover Drives
    const drivesRes = await request(app)
      .get('/api/v1/ui/drives')
      .set('Authorization', token)
      .set('X-Correlation-ID', correlationId)
      .expect(200);

    expect(drivesRes.body.data.length).toBeGreaterThan(0);
    const drive = drivesRes.body.data.find(d => d.drive_id === 'DRV002') || drivesRes.body.data[0];
    const driveId = drive.drive_id;

    // 3. Evaluate Rule-Chain Eligibility via Team A
    const evalRes = await request(app)
      .get(`/api/v1/ui/eligibility/check/${driveId}?student_id=STU001`)
      .set('Authorization', token)
      .set('X-Correlation-ID', correlationId)
      .expect(200);

    expect(evalRes.body.data.evaluation).toBeDefined();
    expect(evalRes.body.data.evaluation.eligibility_result).toBe('ELIGIBLE');

    // 4. Submit Application with Idempotency-Key
    const appRes = await request(app)
      .post('/api/v1/ui/applications')
      .set('Authorization', token)
      .set('X-Correlation-ID', correlationId)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        student_id: 'STU001',
        drive_id: driveId,
        resume_version: 'v1.0',
        consent: true
      });

    expect([200, 201]).toContain(appRes.status);
    const applicationId = appRes.body.data.application_id;
    expect(applicationId).toBeDefined();

    // 5. Track Application State & Timeline
    const trackRes = await request(app)
      .get(`/api/v1/ui/applications/${applicationId}`)
      .set('Authorization', token)
      .set('X-Correlation-ID', correlationId)
      .expect(200);

    expect(trackRes.body.data.application.application_id).toBe(applicationId);
    expect(trackRes.body.data.timeline.length).toBe(8);
    expect(trackRes.body.data.traceability.correlation_id).toBeDefined();

    // 6. View Rankings from Team B
    const rankRes = await request(app)
      .get(`/api/v1/ui/rankings?drive_id=${driveId}`)
      .set('Authorization', token)
      .set('X-Correlation-ID', correlationId)
      .expect(200);

    expect(rankRes.body.data.rankings).toBeDefined();

    // 7. Admin Queries Audit Trail
    const adminLogin = await request(app)
      .post('/api/v1/ui/session')
      .send({ role: 'admin', user_id: 'ADM001' })
      .expect(200);

    const adminToken = adminLogin.body.data.token;
    const auditRes = await request(app)
      .get('/api/v1/ui/audit?limit=10')
      .set('Authorization', adminToken)
      .expect(200);

    expect(auditRes.body.data).toBeDefined();
  });
});
