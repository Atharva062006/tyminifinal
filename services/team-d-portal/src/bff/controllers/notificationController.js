/**
 * Notification Controller for Team D BFF — notifications are persisted by Team C and isolated per recipient.
 */
const { sendSuccess } = require('../utils/apiResponse');
const teamC = require('../services/teamCClient');

class NotificationController {
  list = async (req, res, next) => {
    try { sendSuccess(res, await teamC.listNotifications({ unread: req.query.unread }, req.correlationId, req.user.actor), req.correlationId); } catch (err) { next(err); }
  };

  markAsRead = async (req, res, next) => {
    try { sendSuccess(res, await teamC.markNotificationRead(req.params.id, req.correlationId, req.user.actor), req.correlationId); } catch (err) { next(err); }
  };

  markAllAsRead = async (req, res, next) => {
    try {
      const out = await teamC.markAllNotificationsRead(req.correlationId, req.user.actor);
      sendSuccess(res, { message: 'All notifications marked as read', ...out }, req.correlationId);
    } catch (err) { next(err); }
  };
}

module.exports = new NotificationController();
