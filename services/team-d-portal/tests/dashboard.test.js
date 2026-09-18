const request = require('supertest');
const app = require('../server');

describe('Team D BFF — Dashboard Aggregation API', () => {
  it('GET /api/v1/ui/dashboard returns Student aggregated KPIs', async () => {
    const res = await request(app)
      .get('/api/v1/ui/dashboard')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    expect(res.body.data.role).toBe('student');
    expect(res.body.data.kpis).toBeDefined();
    expect(res.body.data.kpis.total_applications).toBeDefined();
    expect(res.body.data.recent_applications).toBeDefined();
  });

  it('GET /api/v1/ui/dashboard returns Faculty aggregated pipeline metrics', async () => {
    const res = await request(app)
      .get('/api/v1/ui/dashboard')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(200);

    expect(res.body.data.role).toBe('faculty');
    expect(res.body.data.pipeline_distribution).toBeDefined();
    expect(res.body.data.drives_summary).toBeDefined();
  });

  it('GET /api/v1/ui/dashboard returns Admin system health and audit overview', async () => {
    const res = await request(app)
      .get('/api/v1/ui/dashboard')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(200);

    expect(res.body.data.role).toBe('admin');
    expect(res.body.data.system_health).toBeDefined();
  });
});
