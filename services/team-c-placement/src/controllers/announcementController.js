const { sendSuccess } = require('../../../../shared/response');
const { sanitizeObject } = require('../../../../shared/sanitizer');
const { NotFoundError, ValidationError } = require('../../../../shared/errors');
const { v4: uuidv4 } = require('uuid');

class AnnouncementController {
  constructor(db, sseService, notificationService) {
    this.db = db;
    this.sseService = sseService;
    this.notifications = notificationService;
  }

  // GET /api/v1/announcements
  list = (req, res, next) => {
    try {
      const rows = this.db.table('announcements').all().sort((a, b) => b.created_at.localeCompare(a.created_at));
      sendSuccess(res, rows, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v1/announcements
  create = async (req, res, next) => {
    try {
      const s = req.body || {}; // HTML-escaped at render time by the portal
      if (!s.title || !String(s.title).trim()) throw new ValidationError('Title is required', [{ field: 'title', message: 'Required' }]);
      const record = {
        announcement_id: `ANN-${uuidv4().substring(0, 6).toUpperCase()}`,
        title: String(s.title).trim(),
        content: s.content || '',
        author: req.user?.name || s.author || 'TPO Office',
        audience: s.audience || 'ALL',
        created_at: new Date().toISOString(),
      };
      const created = await this.db.table('announcements').insert(record);

      this.sseService.broadcast('audit', { action: 'ANNOUNCEMENT_CREATED', table_name: 'announcements', record_id: record.announcement_id, title: record.title });
      // Fan out as a notification to every active student
      const students = this.db.table('users').find(u => u.role === 'student' && u.active);
      for (const u of students) {
        await this.notifications.notify(u.student_id, { type: 'ANNOUNCEMENT', title: record.title, message: String(record.content).slice(0, 200), entityId: record.announcement_id });
      }
      sendSuccess(res, created, req.correlationId, 201);
    } catch (err) {
      next(err);
    }
  };

  // DELETE /api/v1/announcements/:id
  remove = async (req, res, next) => {
    try {
      if (!this.db.table('announcements').findById(req.params.id)) throw new NotFoundError('Announcement', req.params.id);
      await this.db.table('announcements').delete(req.params.id);
      sendSuccess(res, { deleted: true }, req.correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AnnouncementController;
