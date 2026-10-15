/**
 * System Health & Microservices Telemetry Controller for Team D BFF.
 */
const { sendSuccess } = require('../utils/apiResponse');
const teamA = require('../services/teamAClient');
const teamB = require('../services/teamBClient');
const teamC = require('../services/teamCClient');

const mockFlags = () => ({
  mock_team_a: process.env.MOCK_TEAM_A === 'true',
  mock_team_b: process.env.MOCK_TEAM_B === 'true',
  mock_team_c: process.env.MOCK_TEAM_C === 'true',
});

class SystemController {
  /**
   * GET /api/v1/ui/system
   * Multi-team health plus a real probe of each engine's API (a /health OK alone is not "live").
   */
  getHealth = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;
      const flags = mockFlags();
      const t0 = Date.now();
      const [aHealth, bHealth, cHealth, aMetrics, bMetrics] = await Promise.all([
        teamA.checkHealth(), teamB.checkHealth(), teamC.checkHealth(),
        teamA.getMetrics(correlationId).catch(() => null),
        teamB.getMetrics(correlationId).catch(() => null),
      ]);

      const mode = (health, mocked, metrics) => (mocked ? 'MOCK' : health.status === 'ONLINE' && metrics && !metrics.metrics?.mock ? 'LIVE' : 'FALLBACK');

      sendSuccess(res, {
        timestamp: new Date().toISOString(),
        probe_ms: Date.now() - t0,
        gateway: { service: 'team-d-portal', status: 'ONLINE', port: process.env.PORT || 3000, uptime_seconds: process.uptime() },
        services: [
          { name: 'Team A — OS Eligibility Engine', key: 'team_a', port: 3001, role: 'Rule-chaining, queue scheduling & slot locks', ...aHealth, mode: mode(aHealth, flags.mock_team_a, aMetrics), metrics: aMetrics?.metrics || null },
          { name: 'Team B — DS Ranking Engine', key: 'team_b', port: 3002, role: 'Graph skill matching, Top-K ranking & shortlist index', ...bHealth, mode: mode(bHealth, flags.mock_team_b, bMetrics), metrics: bMetrics?.metrics || null },
          { name: 'Team C — DBMS Placement Engine', key: 'team_c', port: 3003, role: 'Authoritative persistence, WAL & transactions', ...cHealth, mode: flags.mock_team_c ? 'MOCK' : (cHealth.status === 'ONLINE' ? 'LIVE' : 'DOWN') },
          { name: 'Team D — Web Technology Portal', key: 'team_d', port: 3000, role: 'Backend-for-Frontend & UI SPA', status: 'ONLINE', mode: 'LIVE' },
        ],
        config: flags,
      }, correlationId);
    } catch (err) { next(err); }
  };
}

module.exports = new SystemController();
