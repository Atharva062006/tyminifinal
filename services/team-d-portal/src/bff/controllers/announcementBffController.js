/**
 * Team D BFF Announcement Controller.
 */
const teamCClient = require('../services/teamCClient');
const { sendSuccess } = require('../utils/apiResponse');

class AnnouncementBffController {
  // GET /api/v1/ui/announcements
  list = async (req, res, next) => {
    try {
      const announcements = await teamCClient.listAnnouncements(req.correlationId);
      sendSuccess(res, announcements, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v1/ui/announcements
  create = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const created = await teamCClient.createAnnouncement(req.body, req.correlationId, authHeader);
      sendSuccess(res, created, req.correlationId, 201);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new AnnouncementBffController();
