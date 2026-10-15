/**
 * Team D BFF Announcement Controller — announcements are stored by Team C and fan out as notifications.
 */
const teamCClient = require('../services/teamCClient');
const { sendSuccess } = require('../utils/apiResponse');

class AnnouncementBffController {
  list = async (req, res, next) => {
    try { sendSuccess(res, await teamCClient.listAnnouncements(req.correlationId), req.correlationId); } catch (err) { next(err); }
  };

  create = async (req, res, next) => {
    try { sendSuccess(res, await teamCClient.createAnnouncement(req.body || {}, req.correlationId, req.user.actor), req.correlationId, 201); } catch (err) { next(err); }
  };

  remove = async (req, res, next) => {
    try { sendSuccess(res, await teamCClient.deleteAnnouncement(req.params.id, req.correlationId, req.user.actor), req.correlationId); } catch (err) { next(err); }
  };
}

module.exports = new AnnouncementBffController();
