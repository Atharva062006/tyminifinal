const { v4: uuidv4 } = require('uuid');
const { sendSuccess } = require('../../../../shared/response');
const { NotFoundError, ValidationError } = require('../../../../shared/errors');
const { DRIVE_STATES } = require('../../../../shared/constants');
const { teamB } = require('../services/engineClients');

/** Packages may arrive as LPA (e.g. 12.5) or rupees (1250000); the database always stores rupees. */
function normalisePackage(p) {
  if (p == null || p === '') return null;
  const n = Number(p);
  if (Number.isNaN(n) || n < 0) throw new ValidationError('package must be a positive number', [{ field: 'package', message: 'Invalid package' }]);
  return n > 0 && n < 1000 ? Math.round(n * 100000) : n;
}

function criteriaToJson(body) {
  const c = body.criteria !== undefined ? body.criteria : body.criteria_json;
  if (c === undefined) return undefined;
  if (c === null || c === '') return null;
  return typeof c === 'object' ? JSON.stringify(c) : String(c);
}

class DriveController {
  constructor(db) {
    this.db = db;
  }

  _syncProfile(drive) {
    let criteria = {};
    try { criteria = drive.criteria_json ? JSON.parse(drive.criteria_json) : {}; } catch { /* keep empty */ }
    teamB.putDrive(drive.drive_id, { drive_id: drive.drive_id, title: drive.title, criteria, seats: drive.seats_total || drive.seats }).catch(() => {});
  }

  // POST /api/v1/drives
  create = async (req, res, next) => {
    try {
      const b = req.body;
      if (b.state && !Object.values(DRIVE_STATES).includes(b.state)) throw new ValidationError(`state must be one of ${Object.values(DRIVE_STATES).join(', ')}`);
      const now = new Date().toISOString();
      const drive = {
        drive_id: b.drive_id || `DRV-${uuidv4().substring(0, 6).toUpperCase()}`,
        company_id: b.company_id,
        title: b.title,
        seats: b.seats,
        seats_total: b.seats,
        package: normalisePackage(b.package),
        state: b.state || 'DRAFT',
        description: b.description,
        location: b.location,
        deadline: b.deadline,
        drive_date: b.drive_date,
        version: 1,
        created_at: now,
        updated_at: now,
        criteria_json: criteriaToJson(b) ?? null,
      };
      Object.keys(drive).forEach(k => drive[k] === undefined && delete drive[k]);
      const created = await this.db.table('drives').insert(drive);
      this._syncProfile(created);
      sendSuccess(res, created, req.correlationId, 201);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/drives
  list = (req, res, next) => {
    try {
      let drives = this.db.table('drives').all();
      if (req.query.state) drives = drives.filter(d => d.state === req.query.state);
      if (req.query.company_id) drives = drives.filter(d => d.company_id === req.query.company_id);
      drives.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      sendSuccess(res, drives, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/drives/:driveId
  get = (req, res, next) => {
    try {
      const drive = this.db.table('drives').findById(req.params.driveId);
      if (!drive) throw new NotFoundError('Drive', req.params.driveId);
      sendSuccess(res, drive, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/drives/:driveId/criteria
  getCriteria = (req, res, next) => {
    try {
      const drive = this.db.table('drives').findById(req.params.driveId);
      if (!drive) throw new NotFoundError('Drive', req.params.driveId);
      let criteria = {};
      try { criteria = drive.criteria_json ? JSON.parse(drive.criteria_json) : {}; } catch { criteria = {}; }
      sendSuccess(res, { drive_id: drive.drive_id, seats: drive.seats, seats_total: drive.seats_total, criteria }, req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v1/internal/drives/:driveId   (criteria / seats / state / details)
  update = async (req, res, next) => {
    try {
      const { driveId } = req.params;
      const before = this.db.table('drives').findById(driveId);
      if (!before) throw new NotFoundError('Drive', driveId);
      const b = req.body || {};
      const updates = {};
      for (const k of ['title', 'description', 'location', 'deadline', 'drive_date', 'company_id']) if (b[k] !== undefined) updates[k] = b[k];
      if (b.state !== undefined) {
        if (!Object.values(DRIVE_STATES).includes(b.state)) throw new ValidationError(`state must be one of ${Object.values(DRIVE_STATES).join(', ')}`);
        updates.state = b.state;
      }
      if (b.package !== undefined) updates.package = normalisePackage(b.package);
      const crit = criteriaToJson(b);
      if (crit !== undefined) updates.criteria_json = crit;
      if (b.seats !== undefined) {
        // `seats` from the admin form means total capacity; remaining = total - seats already claimed
        const total = Number(b.seats);
        if (!Number.isInteger(total) || total < 1) throw new ValidationError('seats must be a positive integer', [{ field: 'seats', message: 'Invalid' }]);
        const claimed = (before.seats_total || before.seats) - before.seats;
        if (total < claimed) throw new ValidationError(`Cannot reduce seats below the ${claimed} already claimed`);
        updates.seats_total = total;
        updates.seats = total - claimed;
      }
      updates.updated_at = new Date().toISOString();
      updates.version = (before.version || 1) + 1;
      const drive = await this.db.table('drives').update(driveId, updates);
      if (updates.criteria_json !== undefined || updates.seats !== undefined || updates.title !== undefined) this._syncProfile(drive);
      sendSuccess(res, drive, req.correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = DriveController;
