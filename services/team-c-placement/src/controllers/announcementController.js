const { sendSuccess } = require('../../../../shared/response');
const { sanitizeObject } = require('../../../../shared/sanitizer');
const { v4: uuidv4 } = require('uuid');

class AnnouncementController {
  constructor(db, sseService) {
    this.db = db;
    this.sseService = sseService;
  }

  // GET /api/v1/announcements
  list = async (req, res, next) => {
    try {
      const announcements = this.db.table('announcements').all();
      // Sort newest first
      announcements.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      sendSuccess(res, announcements, req.correlationId);
    } catch (err) {
      // Return initial defaults if table not yet populated
      sendSuccess(res, [
        {
          announcement_id: 'ANN-001',
          title: 'Campus Placement Registration Open',
          content: 'Placement drive registration for Academic Year 2026-27 is officially open on RIT Portal.',
          author: 'Prof. Rajesh Kulkarni (TPO)',
          created_at: new Date().toISOString()
        }
      ], req.correlationId);
    }
  };

  // POST /api/v1/announcements
  create = async (req, res, next) => {
    try {
      const sanitized = sanitizeObject(req.body);
      const annId = `ANN-${uuidv4().substring(0, 6).toUpperCase()}`;
      const record = {
        announcement_id: annId,
        title: sanitized.title || 'Institutional Announcement',
        content: sanitized.content || '',
        author: sanitized.author || 'TPO Office',
        created_at: new Date().toISOString()
      };

      const created = await this.db.table('announcements').insert(record);

      if (this.sseService) {
        this.sseService.broadcast({
          type: 'audit',
          action: 'ANNOUNCEMENT_CREATED',
          table_name: 'announcements',
          record_id: annId,
          title: record.title
        });
      }

      sendSuccess(res, created, req.correlationId, 201);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AnnouncementController;
