// Team A — Queue Controller
// GET /api/v1/drives/:driveId/queue
const { sendSuccess } = require('../../../../shared/response');

module.exports = (engine) => ({
  getDriveQueue: (req, res, next) => {
    try {
      sendSuccess(res, engine.scheduler.queueView(req.params.driveId), req.correlationId);
    } catch (err) { next(err); }
  },
});
