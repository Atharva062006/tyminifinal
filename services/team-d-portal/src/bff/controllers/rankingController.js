/**
 * Candidate Ranking & Shortlist Controller for Team D BFF.
 */
const { sendSuccess } = require('../utils/apiResponse');
const { ValidationError, NotFoundError, ForbiddenError } = require('../../../../../shared/errors');
const rankingService = require('../services/rankingService');
const teamC = require('../services/teamCClient');

class RankingController {
  /**
   * GET /api/v1/ui/rankings
   * Get candidate rankings for a drive from Team B.
   */
  get = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;
      let driveId = req.query.drive_id;

      if (!driveId) {
        const drives = await teamC.listDrives({}, correlationId).catch(() => []);
        if (drives.length > 0) {
          driveId = drives[0].drive_id;
        }
      }

      if (!driveId) {
        throw new ValidationError('drive_id is required');
      }

      // Verify drive existence
      const drive = await teamC.getDrive(driveId, correlationId).catch(() => null);
      if (!drive) {
        throw new NotFoundError('Drive', driveId);
      }

      const algorithm = req.query.algorithm || 'WEIGHTED_SCORE';
      const rankings = await rankingService.getDriveRankings(driveId, { algorithm }, correlationId, req.user?.actor);

      // Student privacy filtering: highlight student's own rank, anonymize others
      if (req.user?.role === 'student') {
        const studentId = req.user.id;
        const myCandidate = rankings.rankings.find(c => c.student_id === studentId);
        
        rankings.my_ranking = myCandidate ? {
          rank: myCandidate.rank,
          total_score: myCandidate.total_score,
          candidates_count: rankings.candidates_count,
          algorithm: rankings.algorithm
        } : null;

        rankings.disqualified = (rankings.disqualified || []).filter(d => d.student_id === studentId);
        rankings.rankings = rankings.rankings.map(c => {
          if (c.student_id === studentId) {
            return c;
          }
          return {
            student_id: `ANON-${c.rank}`,
            name: `Candidate #${c.rank}`,
            rank: c.rank,
            total_score: c.total_score,
            algorithm: c.algorithm
          };
        });
      }

      sendSuccess(res, rankings, correlationId);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/ui/rankings/preview
   * Preview candidate ranking with custom algorithm / weights.
   */
  preview = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;

      // Authorization guard: Students cannot preview or alter administrative rankings
      if (req.user?.role === 'student') {
        throw new ForbiddenError('Students are not authorized to preview or recalculate candidate rankings');
      }

      const { drive_id, algorithm, weights } = req.body;
      if (!drive_id) {
        throw new ValidationError('drive_id is required for ranking preview');
      }

      const drive = await teamC.getDrive(drive_id, correlationId).catch(() => null);
      if (!drive) {
        throw new NotFoundError('Drive', drive_id);
      }

      const rankings = await rankingService.getDriveRankings(drive_id, {
        algorithm: algorithm || 'WEIGHTED_SCORE',
        weights: weights || { cgpa: 0.4, skills: 0.4, attendance: 0.2 }
      }, correlationId, req.user?.actor);

      sendSuccess(res, rankings, correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new RankingController();
