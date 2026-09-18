/**
 * System Health & Microservices Telemetry Controller for Team D BFF.
 */
const { sendSuccess } = require('../utils/apiResponse');
const teamA = require('../services/teamAClient');
const teamB = require('../services/teamBClient');
const teamC = require('../services/teamCClient');

class SystemController {
  /**
   * GET /api/v1/ui/system
   * Comprehensive multi-team microservices health and connectivity check.
   */
  getHealth = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;

      const [aHealth, bHealth, cHealth] = await Promise.all([
        teamA.checkHealth(),
        teamB.checkHealth(),
        teamC.checkHealth()
      ]);

      const systemStatus = {
        timestamp: new Date().toISOString(),
        gateway: {
          service: 'team-d-portal',
          status: 'ONLINE',
          port: process.env.PORT || 3000,
          uptime_seconds: process.uptime()
        },
        services: [
          {
            name: 'Team A — OS Eligibility Engine',
            port: 3001,
            role: 'Rule-chaining, queue scheduling & slot locks',
            ...aHealth
          },
          {
            name: 'Team B — DS Ranking Engine',
            port: 3002,
            role: 'Graph skill matching & Top-K ranking',
            ...bHealth
          },
          {
            name: 'Team C — DBMS Placement Engine',
            port: 3003,
            role: 'Authoritative persistence, WAL & transactions',
            ...cHealth
          },
          {
            name: 'Team D — Web Technology Portal',
            port: 3000,
            role: 'Backend-for-Frontend & UI SPA',
            status: 'ONLINE'
          }
        ],
        config: {
          mock_team_a: process.env.MOCK_TEAM_A === 'true',
          mock_team_b: process.env.MOCK_TEAM_B === 'true',
          mock_team_c: process.env.MOCK_TEAM_C === 'true'
        }
      };

      sendSuccess(res, systemStatus, correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new SystemController();
