/**
 * NotificationService — persistent, recipient-isolated notifications (Team C `notifications` table).
 * Students are addressed by student_id, staff by user_id. Staff broadcasts fan out one row per staff user.
 */
const { v4: uuidv4 } = require('uuid');
const sseService = require('./sseService');

class NotificationService {
  constructor(db) {
    this.db = db;
  }

  _staffIds(roles = ['faculty', 'admin']) {
    return this.db.table('users').find(u => roles.includes(u.role) && u.active).map(u => u.user_id);
  }

  async notify(recipientId, { type, title, message, entityId }) {
    if (!recipientId) return null;
    const row = {
      notification_id: `NTF-${uuidv4().substring(0, 8).toUpperCase()}`,
      recipient_id: String(recipientId),
      type,
      title,
      message: message || '',
      entity_id: entityId || null,
      read: false,
      created_at: new Date().toISOString(),
    };
    await this.db.table('notifications').insert(row);
    sseService.broadcast('notification', { recipient_id: row.recipient_id, type, title, entity_id: row.entity_id, timestamp: row.created_at });
    return row;
  }

  async notifyStaff(payload, roles) {
    const out = [];
    for (const id of this._staffIds(roles)) out.push(await this.notify(id, payload));
    return out;
  }

  list(recipientId, { unread } = {}) {
    let rows = this.db.lookupBy('notifications', 'recipient_id', String(recipientId));
    if (unread) rows = rows.filter(n => !n.read);
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const all = this.db.lookupBy('notifications', 'recipient_id', String(recipientId));
    return { notifications: rows.slice(0, 200), unread_count: all.filter(n => !n.read).length, total: all.length };
  }

  async markRead(id, recipientId) {
    const n = this.db.table('notifications').findById(id);
    if (!n) return null;
    if (n.recipient_id !== String(recipientId)) return 'FORBIDDEN';
    return this.db.table('notifications').update(id, { read: true });
  }

  async markAllRead(recipientId) {
    const rows = this.db.lookupBy('notifications', 'recipient_id', String(recipientId)).filter(n => !n.read);
    for (const n of rows) await this.db.table('notifications').update(n.notification_id, { read: true });
    return { updated: rows.length };
  }
}

module.exports = NotificationService;
