/**
 * Mock Adapter for Team B — DS Ranking Engine (Port 3002).
 * Used when MOCK_TEAM_B=true or when Team B is offline.
 * Implements deterministic ranking and graph matching logic.
 */
const { v4: uuidv4 } = require('uuid');

class MockTeamB {
  constructor() {
    this.rankings = new Map();
    this.metrics = {
      mock: true,
      p95_ranking_latency_ms: 32,
      graph_version: '2.1.0',
      total_edges: 450,
      total_vertices: 120,
      cache_hit_rate_pct: 86.4,
      supported_algorithms: ['WEIGHTED_SCORE', 'HEAP_TOPK', 'MERGE_SORT']
    };
  }

  /**
   * Compute ranking for a candidate pool against a drive
   */
  async computeRanking(data) {
    const { drive_id, candidates = [], algorithm = 'WEIGHTED_SCORE', weights = {} } = data;
    const rankingId = `RNK-${uuidv4().substring(0, 8)}`;

    const scored = candidates.map(c => {
      // Calculate a deterministic score based on student attributes
      let score = 0;
      const cgpaScore = ((c.cgpa || 7.0) / 10) * (weights.cgpa || 0.4);
      const skillsCount = (c.skills || []).length;
      const skillScore = Math.min(skillsCount / 4, 1.0) * (weights.skills || 0.4);
      const attendanceScore = ((c.attendance || 80) / 100) * (weights.attendance || 0.2);
      
      score = parseFloat((cgpaScore + skillScore + attendanceScore).toFixed(3));

      return {
        student_id: c.student_id,
        name: c.name || c.student_id,
        branch: c.branch || 'CSE',
        cgpa: c.cgpa,
        total_score: score,
        skill_match_pct: Math.min(Math.round(skillScore * 250), 100),
        score_breakdown: {
          cgpa_component: parseFloat(cgpaScore.toFixed(4)),
          skills_component: parseFloat(skillScore.toFixed(4)),
          attendance_component: parseFloat(attendanceScore.toFixed(4))
        },
        algorithm: algorithm,
        tie_break_priority: c.student_id
      };
    });

    // Sort descending by score
    scored.sort((a, b) => {
      if (b.total_score !== a.total_score) {
        return b.total_score - a.total_score;
      }
      return a.student_id.localeCompare(b.student_id);
    });

    const orderedCandidates = scored.map((item, index) => ({
      ...item,
      rank: index + 1
    }));

    const result = {
      ranking_id: rankingId,
      drive_id: drive_id,
      algorithm: algorithm,
      graph_version: '2.1.0',
      total_candidates: orderedCandidates.length,
      ordered_candidates: orderedCandidates,
      computation_time_ms: 14,
      generated_at: new Date().toISOString()
    };

    this.rankings.set(rankingId, result);
    return result;
  }

  /**
   * Get ranking by ID
   */
  async getRanking(rankingId) {
    if (this.rankings.has(rankingId)) {
      return this.rankings.get(rankingId);
    }
    return {
      ranking_id: rankingId,
      algorithm: 'WEIGHTED_SCORE',
      graph_version: '2.1.0',
      ordered_candidates: []
    };
  }

  /**
   * Get profiles and graph summary
   */
  async getProfiles() {
    return {
      graph_version: '2.1.0',
      vertices_count: 120,
      edges_count: 450,
      skills_registry: ['JavaScript', 'Python', 'React', 'Node.js', 'SQL', 'Java', 'Spring', 'C++', 'DSA', 'ML'],
      drives_indexed: 4
    };
  }

  /**
   * Performance-trend / cohort analysis
   */
  async analyseCohort(params = {}) {
    return {
      department_trend: [
        { department: 'CSE', average_score: 0.84, top_rankers_count: 12 },
        { department: 'IT', average_score: 0.81, top_rankers_count: 8 },
        { department: 'ENTC', average_score: 0.74, top_rankers_count: 5 }
      ],
      algorithm_comparison: [
        { algorithm: 'WEIGHTED_SCORE', latency_us: 450, complexity: 'O(N)' },
        { algorithm: 'HEAP_TOPK', latency_us: 280, complexity: 'O(N log K)' },
        { algorithm: 'MERGE_SORT', latency_us: 620, complexity: 'O(N log N)' }
      ],
      time_complexity_verified: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get metrics
   */
  async getMetrics() {
    return {
      service: 'team-b-ranking',
      timestamp: new Date().toISOString(),
      metrics: this.metrics
    };
  }
}

module.exports = new MockTeamB();
