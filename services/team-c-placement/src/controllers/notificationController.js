const { sendSuccess } = require('../../../../shared/response');
const { NotFoundError, ForbiddenError } = require('../../../../shared/errors');

class NotificationController {
  constructor(notificationService) { this.svc = notificationService; }

  // The recipient is always the caller (service calls name the actor via X-Actor-Id)
  list = (req, res, next) => {
    try { sendSuccess(res, this.svc.list(req.user.id, { unread: req.query.unread === 'true' }), req.correlationId); } catch (e) { next(e); }
  };

  markRead = async (req, res, next) => {
    try {
      const out = await this.svc.markRead(req.params.id, req.user.id);
      if (!out) throw new NotFoundError('Notification', req.params.id);
      if (out === 'FORBIDDEN') throw new ForbiddenError('You can only modify your own notifications');
      sendSuccess(res, out, req.correlationId);
    } catch (e) { next(e); }
  };

  markAllRead = async (req, res, next) => {
    try { sendSuccess(res, await this.svc.markAllRead(req.user.id), req.correlationId); } catch (e) { next(e); }
  };
}

module.exports = NotificationController;
