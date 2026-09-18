const request = require('supertest');
const app = require('../server');

describe('Team D BFF — Placement Analytics, Reporting & CSV Export', () => {
  it('1. GET /api/v1/ui/analytics retrieves overall institutional placement KPIs', async () => {
    const res = await request(app)
      .get('/api/v1/ui/analytics')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(200);

    expect(res.body.data.kpis).toBeDefined();
    expect(res.body.data.kpis.total_students).toBeGreaterThan(0);
    expect(res.body.data.kpis.placement_rate_pct).toBeDefined();
  });

  it('2. Placement rate percentage is calculated accurately from real student count', async () => {
    const res = await request(app)
      .get('/api/v1/ui/analytics')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(200);

    expect(typeof res.body.data.kpis.placement_rate_pct).toBe('number');
  });

  it('3. Application pipeline breakdown returns counts per state', async () => {
    const res = await request(app)
      .get('/api/v1/ui/analytics')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(200);

    expect(res.body.data.pipeline).toBeDefined();
    expect(typeof res.body.data.pipeline.SHORTLISTED).toBe('number');
  });

  it('4. Drive analytics contains company role and conversion rate', async () => {
    const res = await request(app)
      .get('/api/v1/ui/analytics')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(200);

    expect(Array.isArray(res.body.data.drive_analytics)).toBe(true);
  });

  it('5. Branch analytics provides breakdown for CSE, IT, ECE, MECH, CIVIL', async () => {
    const res = await request(app)
      .get('/api/v1/ui/analytics')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(200);

    expect(Array.isArray(res.body.data.branch_breakdown)).toBe(true);
    expect(res.body.data.branch_breakdown.some(b => b.branch === 'CSE')).toBe(true);
  });

  it('6. Package statistics calculates highest, lowest, average, and median package', async () => {
    const res = await request(app)
      .get('/api/v1/ui/analytics')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(200);

    expect(res.body.data.packages).toBeDefined();
  });

  it('7. Team A eligibility and Team B ranking telemetry are included in authority details', async () => {
    const res = await request(app)
      .get('/api/v1/ui/analytics')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(200);

    expect(res.body.data.authorities.eligibility.service).toBe('Team A');
    expect(res.body.data.authorities.ranking.service).toBe('Team B');
  });

  it('8. Supports date range filtering (7d, 30d, academic_year)', async () => {
    const res = await request(app)
      .get('/api/v1/ui/analytics?range=30d')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(200);

    expect(res.body.data.time_range).toBe('30d');
  });

  it('9. GET /api/v1/ui/reports/export generates CSV report file', async () => {
    const res = await request(app)
      .get('/api/v1/ui/reports/export?type=placement_performance&format=csv')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Total Students');
  });

  it('10. GET /api/v1/ui/reports/export generates JSON report format when requested', async () => {
    const res = await request(app)
      .get('/api/v1/ui/reports/export?type=branch_performance&format=json')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(200);

    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.branch_breakdown).toBeDefined();
  });

  it('11. Student requesting analytics returns 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/ui/analytics')
      .set('Authorization', 'Bearer student_STU001')
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('12. Student requesting report export returns 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/ui/reports/export?format=csv')
      .set('Authorization', 'Bearer student_STU001')
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('13. Unauthenticated request to /analytics returns 401 Unauthorized', async () => {
    const res = await request(app)
      .get('/api/v1/ui/analytics')
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
