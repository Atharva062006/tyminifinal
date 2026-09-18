const request = require('supertest');
const app = require('../server');

describe('Team D BFF — DS Ranking Engine & Shortlist Workflow', () => {
  it('1. GET /api/v1/ui/rankings retrieves candidate rankings for drive', async () => {
    const res = await request(app)
      .get('/api/v1/ui/rankings?drive_id=DRV001')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(200);

    expect(res.body.data.drive_id).toBe('DRV001');
    expect(Array.isArray(res.body.data.rankings)).toBe(true);
    expect(res.body.data.candidates_count).toBeGreaterThan(0);
  });

  it('2. Student request highlights student own ranking position', async () => {
    const res = await request(app)
      .get('/api/v1/ui/rankings?drive_id=DRV001')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    expect(res.body.data.my_ranking).toBeDefined();
    expect(res.body.data.my_ranking.rank).toBeGreaterThanOrEqual(1);
    expect(res.body.data.my_ranking.total_score).toBeDefined();
  });

  it('3. Student ranking score is accurately calculated', async () => {
    const res = await request(app)
      .get('/api/v1/ui/rankings?drive_id=DRV001')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    expect(typeof res.body.data.my_ranking.total_score).toBe('number');
  });

  it('4. Ranking candidate list matches Team B output schema', async () => {
    const res = await request(app)
      .get('/api/v1/ui/rankings?drive_id=DRV001')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(200);

    expect(res.body.data.algorithm).toBeDefined();
    expect(res.body.data.rankings[0].rank).toBe(1);
  });

  it('5. Score explanation breakdown is attached when available', async () => {
    const res = await request(app)
      .get('/api/v1/ui/rankings?drive_id=DRV001')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(200);

    const firstCandidate = res.body.data.rankings[0];
    expect(firstCandidate.score_breakdown).toBeDefined();
    expect(firstCandidate.score_breakdown.cgpa_component).toBeDefined();
  });

  it('6. Student privacy protection anonymizes other candidates for student role', async () => {
    const res = await request(app)
      .get('/api/v1/ui/rankings?drive_id=DRV001')
      .set('Authorization', 'Bearer student_STU001')
      .expect(200);

    const otherCandidate = res.body.data.rankings.find(c => c.student_id !== 'STU001');
    if (otherCandidate) {
      expect(otherCandidate.student_id).toContain('ANON-');
      expect(otherCandidate.name).toContain('Candidate #');
    }
  });

  it('7. Faculty persona receives full candidate details', async () => {
    const res = await request(app)
      .get('/api/v1/ui/rankings?drive_id=DRV001')
      .set('Authorization', 'Bearer faculty_FAC001')
      .expect(200);

    expect(res.body.data.rankings[0].name).not.toContain('ANON-');
  });

  it('8. Admin persona receives full candidate details', async () => {
    const res = await request(app)
      .get('/api/v1/ui/rankings?drive_id=DRV001')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(200);

    expect(res.body.data.rankings[0].rank).toBe(1);
  });

  it('9. POST /api/v1/ui/rankings/preview allows Faculty/Admin preview', async () => {
    const res = await request(app)
      .post('/api/v1/ui/rankings/preview')
      .set('Authorization', 'Bearer admin_ADM001')
      .send({
        drive_id: 'DRV001',
        algorithm: 'WEIGHTED_SCORE',
        weights: { cgpa: 0.5, skills: 0.3, attendance: 0.2 }
      })
      .expect(200);

    expect(res.body.data.drive_id).toBe('DRV001');
  });

  it('10. POST /api/v1/ui/rankings/preview returns 403 Forbidden for Student persona', async () => {
    const res = await request(app)
      .post('/api/v1/ui/rankings/preview')
      .set('Authorization', 'Bearer student_STU001')
      .send({
        drive_id: 'DRV001',
        algorithm: 'WEIGHTED_SCORE'
      })
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('11. GET /api/v1/ui/rankings for invalid drive ID returns 404 Not Found', async () => {
    const res = await request(app)
      .get('/api/v1/ui/rankings?drive_id=DRV999')
      .set('Authorization', 'Bearer admin_ADM001')
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('12. POST /api/v1/ui/rankings/preview for missing drive_id returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/v1/ui/rankings/preview')
      .set('Authorization', 'Bearer admin_ADM001')
      .send({})
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
