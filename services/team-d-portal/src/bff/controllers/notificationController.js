/**
 * Notification Controller for Team D BFF.
 * Provides recipient-isolated notification list, unread count, and read status management.
 */
const { sendSuccess } = require('../utils/apiResponse');
const { ForbiddenError, NotFoundError } = require('../../../../../shared/errors');
const { sanitizeObject } = require('../../../../../shared/sanitizer');

class NotificationController {
  constructor() {
    // In-memory recipient-isolated notification store
    this.notifications = [
      {
        id: 'NOTIF-001',
        recipient_id: 'STU001',
        type: 'INTERVIEW_SCHEDULED',
        title: 'Interview Scheduled',
        message: 'Your Technical Interview for SDE Intern 2026 at TechCorp has been scheduled.',
        entity_id: 'APP-001',
        read: false,
        created_at: new Date().toISOString()
      },
      {
        id: 'NOTIF-002',
        recipient_id: 'STU001',
        type: 'OFFER_ISSUED',
        title: 'Placement Offer Issued 🎉',
        message: 'Congratulations! You received a placement offer from DataSoft at ₹7.5 LPA.',
        entity_id: 'APP-001',
        read: false,
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'NOTIF-003',
        recipient_id: 'FAC001',
        type: 'APPLICATION_SUBMITTED',
        title: 'New Student Application',
        message: 'Student Aarav Sharma (STU001) applied for SDE Intern 2026.',
        entity_id: 'APP-001',
        read: false,
        created_at: new Date(Date.now() - 7200000).toISOString()
      }
    ];
  }

  // GET /api/v1/ui/notifications
  list = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;
      const recipientId = req.user?.id || 'STU001';

      // Filter notifications for authenticated recipient only
      let userNotifs = this.notifications.filter(n => n.recipient_id === recipientId);
      
      // Filter by unread query if provided
      if (req.query.unread === 'true') {
        userNotifs = userNotifs.filter(n => !n.read);
      }

      // Sort newest first
      userNotifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      const unreadCount = userNotifs.filter(n => !n.read).length;

      sendSuccess(res, {
        notifications: userNotifs.map(sanitizeObject),
        unread_count: unreadCount,
        total: userNotifs.length
      }, correlationId);
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v1/ui/notifications/:id/read
  markAsRead = async (req, res, next) => {
    try {
      const { id } = req.params;
      const correlationId = req.correlationId;
      const recipientId = req.user?.id || 'STU001';

      const notif = this.notifications.find(n => n.id === id);
      if (!notif) {
        throw new NotFoundError('Notification', id);
      }

      if (notif.recipient_id !== recipientId && req.user?.role === 'student') {
        throw new ForbiddenError('You can only modify your own notifications');
      }

      notif.read = true;
      sendSuccess(res, sanitizeObject(notif), correlationId);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v1/ui/notifications/read-all
  markAllAsRead = async (req, res, next) => {
    try {
      const correlationId = req.correlationId;
      const recipientId = req.user?.id || 'STU001';

      this.notifications.forEach(n => {
        if (n.recipient_id === recipientId) {
          n.read = true;
        }
      });

      sendSuccess(res, { message: 'All notifications marked as read' }, correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new NotificationController();
