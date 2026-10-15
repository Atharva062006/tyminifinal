/**
 * Database — Main facade for Team C's custom DBMS engine.
 *
 * Assembles: StorageEngine + WAL + LockManager + TransactionManager
 *            + SchemaManager + BTreeIndex/HashIndex + Migrations
 *
 * Usage:
 *   const db = new Database();
 *   await db.initialize();
 *
 *   // Simple single-operation (auto-wraps in transaction):
 *   const student = await db.table('students').insert({ student_id: ..., name: ..., ... });
 *   const found   = await db.table('students').findById('STU001');
 *   const list    = await db.table('students').find(r => r.cgpa >= 8.0);
 *
 *   // Explicit multi-step transaction:
 *   const result = await db.transaction(async (txn) => {
 *     await txn.insert('applications', appId, appRow);
 *     await txn.update('drives', driveId, { seats: drive.seats - 1 });
 *     return { application_id: appId };
 *   });
 *
 *   // Index-powered queries:
 *   const highCgpa = db.index('students_cgpa_btree').rangeQuery(8.5, 10);
 *   const byEmail  = db.index('students_email_hash').lookup('alice@rit.edu');
 */

const path                                        = require('path');
const fs                                          = require('fs');
const StorageEngine                               = require('./engine/StorageEngine');
const WAL                                         = require('./engine/WAL');
const LockManager                                 = require('./engine/LockManager');
const { TransactionManager }                      = require('./engine/TransactionManager');
const BTreeIndex                                  = require('./indexes/BTreeIndex');
const HashIndex                                   = require('./indexes/HashIndex');
const { SchemaManager }                           = require('./schema/SchemaManager');
const { migrations }                              = require('./schema/migrations');

const DATA_DIR = path.resolve(__dirname, '../../data');

class TableAPI {
  /**
   * @param {string}             tableName
   * @param {StorageEngine}      storage
   * @param {TransactionManager} txnManager
   * @param {SchemaManager}      schema
   * @param {Map}                indexes
   */
  constructor(tableName, storage, txnManager, schema, indexes) {
    this.tableName  = tableName;
    this.storage    = storage;
    this.txnManager = txnManager;
    this.schema     = schema;
    this.indexes    = indexes;
  }

  /**
   * Insert a row. Validates constraints and updates indexes.
   * @param {object} row
   * @returns {object} Inserted row
   */
  async insert(row) {
    const pk = row[this.schema.getPrimaryKey(this.tableName)];
    if (!pk) throw new Error(`Primary key missing in row for table '${this.tableName}'`);
    this.schema.validate(this.tableName, row);
    this.schema.validateUnique(this.tableName, row, this.storage);
    this.schema.validateForeignKeys(this.tableName, row, this.storage);

    await this.txnManager.execute(async (txn) => {
      await txn.insert(this.tableName, String(pk), row);
    });

    this._updateIndexesOnInsert(row, pk);
    return row;
  }

  /**
   * Update a row by primary key (partial merge).
   * @param {string} pk
   * @param {object} updates
   * @returns {object} Updated row
   */
  async update(pk, updates) {
    const before = this.storage.getRow(this.tableName, String(pk));
    if (!before) throw new Error(`Row '${pk}' not found in '${this.tableName}'`);
    const merged = { ...before, ...updates };
    this.schema.validate(this.tableName, merged, true);
    let updated;
    await this.txnManager.execute(async (txn) => {
      updated = await txn.update(this.tableName, String(pk), updates);
    });
    this._updateIndexesOnUpdate(before, updated || merged);
    return updated || merged;
  }

  /**
   * Delete a row by primary key.
   */
  async delete(pk) {
    const before = this.storage.getRow(this.tableName, String(pk));
    if (!before) throw new Error(`Row '${pk}' not found in '${this.tableName}'`);
    await this.txnManager.execute(async (txn) => {
      await txn.delete(this.tableName, String(pk));
    });
    this._updateIndexesOnDelete(before, pk);
  }

  /**
   * Find a row by primary key.
   * @param {string} pk
   * @returns {object|null}
   */
  findById(pk) {
    return this.storage.getRow(this.tableName, String(pk));
  }

  /**
   * Find rows matching a predicate.
   * @param {Function} predicate - (row) => boolean
   * @returns {object[]}
   */
  find(predicate) {
    return this.storage.findRows(this.tableName, predicate);
  }

  /**
   * Return all rows in the table.
   * @returns {object[]}
   */
  all() {
    return this.storage.readTable(this.tableName);
  }

  /**
   * Count all rows.
   */
  count() {
    return this.storage.countRows(this.tableName);
  }

  // ─── Index maintenance ────────────────────────────────────────────────────

  _updateIndexesOnInsert(row, pk) {
    for (const [name, idx] of this.indexes.entries()) {
      if (!name.startsWith(this.tableName + '_')) continue;
      const field = idx._fieldName;
      if (field && row[field] !== undefined) {
        idx.insert(row[field], String(pk));
      }
    }
  }

  _updateIndexesOnUpdate(before, after) {
    for (const [name, idx] of this.indexes.entries()) {
      if (!name.startsWith(this.tableName + '_')) continue;
      const field = idx._fieldName;
      if (!field) continue;
      const pk = String(after[this.schema.getPrimaryKey(this.tableName)]);
      if (before[field] !== after[field]) {
        if (before[field] !== undefined) idx.delete(before[field], pk);
        if (after[field] !== undefined)  idx.insert(after[field], pk);
      }
    }
  }

  _updateIndexesOnDelete(row, pk) {
    for (const [name, idx] of this.indexes.entries()) {
      if (!name.startsWith(this.tableName + '_')) continue;
      const field = idx._fieldName;
      if (field && row[field] !== undefined) {
        idx.delete(row[field], String(pk));
      }
    }
  }
}

class Database {
  constructor(dataDir = DATA_DIR) {
    this.dataDir    = dataDir;
    this.storage    = new StorageEngine(dataDir);
    this.wal        = new WAL(path.join(dataDir, 'wal'));
    this.lockMgr    = new LockManager();
    this.txnManager = new TransactionManager(this.storage, this.wal, this.lockMgr);
    this.schema     = new SchemaManager();
    this.indexes    = new Map(); // indexName -> BTreeIndex | HashIndex
    this._initialized = false;
  }

  /**
   * Initialize the database:
   *   1. Create data directories
   *   2. Run WAL recovery
   *   3. Run migrations
   *   4. Build indexes from existing data
   */
  async initialize() {
    if (this._initialized) return;

    // 1. Initialize storage and WAL
    this.storage.initialize();
    this.wal.initialize();

    // 2. Crash recovery — replay committed WAL entries
    const replayed = this.wal.recover(this.storage);
    if (replayed > 0) console.log(`[DB] WAL recovery: replayed ${replayed} committed transactions`);

    // 3. Run migrations
    await this._runMigrations();

    // 4. Register indexes
    this._registerIndexes();

    // 5. Build indexes from existing table data
    this._buildIndexes();

    this._initialized = true;
    console.log('[DB] Database initialized successfully.');
  }

  // ─── Migrations ────────────────────────────────────────────────────────────

  async _runMigrations() {
    const versionFile = path.join(this.dataDir, 'schema_version.json');
    let currentVersion = 0;
    if (fs.existsSync(versionFile)) {
      try { currentVersion = JSON.parse(fs.readFileSync(versionFile, 'utf8')).version || 0; }
      catch { currentVersion = 0; }
    }

    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`[DB] Running migration v${migration.version}: ${migration.name}`);
        await migration.up(this);
        currentVersion = migration.version;
        fs.writeFileSync(versionFile, JSON.stringify({ version: currentVersion, appliedAt: new Date().toISOString() }), 'utf8');
      }
    }
  }

  // ─── Index Registration ────────────────────────────────────────────────────

  _registerIndexes() {
    const register = (name, idx, fieldName) => {
      idx._fieldName = fieldName;
      this.indexes.set(name, idx);
    };

    // students
    register('students_student_id_hash', new HashIndex('students_student_id_hash'), 'student_id');
    register('students_email_hash',      new HashIndex('students_email_hash'),      'email');
    register('students_cgpa_btree',      new BTreeIndex('students_cgpa_btree'),     'cgpa');

    // companies
    register('companies_company_id_hash', new HashIndex('companies_company_id_hash'), 'company_id');

    // drives
    register('drives_drive_id_hash',      new HashIndex('drives_drive_id_hash'),    'drive_id');
    register('drives_state_btree',        new BTreeIndex('drives_state_btree'),     'state');
    register('drives_created_at_btree',   new BTreeIndex('drives_created_at_btree'), 'created_at');

    // applications
    register('applications_application_id_hash',  new HashIndex('applications_application_id_hash'), 'application_id');
    register('applications_idempotency_key_hash', new HashIndex('applications_idempotency_key_hash'), 'idempotency_key');
    register('applications_state_btree',          new BTreeIndex('applications_state_btree'),         'state');
    register('applications_student_id_hash',      new HashIndex('applications_student_id_hash'),      'student_id');

    // eligibility_decisions
    register('eligibility_decisions_decision_id_hash',    new HashIndex('eligibility_decisions_decision_id_hash'), 'decision_id');
    register('eligibility_decisions_application_id_hash', new HashIndex('eligibility_decisions_application_id_hash'), 'application_id');

    // offers
    register('offers_offer_id_hash',         new HashIndex('offers_offer_id_hash'),         'offer_id');
    register('offers_application_id_hash',   new HashIndex('offers_application_id_hash'),   'application_id');

    // audit_log
    register('audit_log_timestamp_btree',      new BTreeIndex('audit_log_timestamp_btree'),      'timestamp');
    register('audit_log_correlation_id_hash',  new HashIndex('audit_log_correlation_id_hash'),  'correlation_id');
    register('audit_log_record_id_hash',       new HashIndex('audit_log_record_id_hash'),       'record_id');

    register('applications_drive_id_hash',        new HashIndex('applications_drive_id_hash'),        'drive_id');
    register('applications_created_at_btree',     new BTreeIndex('applications_created_at_btree'),    'created_at');

    // users
    register('users_user_id_hash',  new HashIndex('users_user_id_hash'),  'user_id');
    register('users_username_hash', new HashIndex('users_username_hash'), 'username');

    // notifications
    register('notifications_notification_id_hash', new HashIndex('notifications_notification_id_hash'), 'notification_id');
    register('notifications_recipient_id_hash',    new HashIndex('notifications_recipient_id_hash'),    'recipient_id');

    // interviews
    register('interviews_interview_id_hash',    new HashIndex('interviews_interview_id_hash'),    'interview_id');
    register('interviews_application_id_hash',  new HashIndex('interviews_application_id_hash'),  'application_id');
    register('interviews_scheduled_at_btree',   new BTreeIndex('interviews_scheduled_at_btree'),  'scheduled_at');

    // announcements
    register('announcements_announcement_id_hash', new HashIndex('announcements_announcement_id_hash'), 'announcement_id');
    register('announcements_created_at_btree',     new BTreeIndex('announcements_created_at_btree'),    'created_at');

    // idempotency_keys
    register('idempotency_keys_key_hash', new HashIndex('idempotency_keys_key_hash'), 'key');
  }

  _buildIndexes() {
    for (const tableName of this.schema.getTableNames()) {
      const rows = this.storage.readTable(tableName);
      for (const row of rows) {
        const pk = String(row[this.schema.getPrimaryKey(tableName)]);
        for (const [name, idx] of this.indexes.entries()) {
          if (name.startsWith(tableName + '_') && idx._fieldName && row[idx._fieldName] !== undefined) {
            idx.insert(row[idx._fieldName], pk);
          }
        }
      }
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Get a TableAPI for the given table name.
   * @param {string} tableName
   * @returns {TableAPI}
   */
  table(tableName) {
    this.schema.getTableSchema(tableName); // validates table exists
    return new TableAPI(tableName, this.storage, this.txnManager, this.schema, this.indexes);
  }

  /**
   * Execute a function within an explicit ACID transaction.
   * @param {Function} fn - async (txn) => result
   */
  async transaction(fn) {
    return this.txnManager.execute(fn);
  }

  /**
   * Execute an ACID transaction whose writes are schema/FK-validated and keep every index in sync.
   * Use this for multi-table workflows (application state changes, seat claims, offers).
   * @param {Function} fn - async (txn) => result
   */
  async transactionIndexed(fn) {
    const touched = [];
    const self = this;
    const result = await this.txnManager.execute(async (txn) => {
      const proxy = {
        txnId: txn.txnId,
        lock: (r, m) => txn.lock(r, m),
        read: (t, pk) => txn.read(t, pk),
        readForUpdate: (t, pk) => txn.readForUpdate(t, pk),
        find: (t, p) => txn.find(t, p),
        readAll: (t) => txn.readAll(t),
        async insert(t, pk, row) {
          self.schema.validate(t, row);
          self.schema.validateForeignKeys(t, row, self.storage);
          const r = await txn.insert(t, String(pk), row);
          touched.push({ t, op: 'insert', pk: String(pk), after: row });
          return r;
        },
        async update(t, pk, updates) {
          const before = { ...self.storage.getRow(t, String(pk)) };
          self.schema.validate(t, { ...before, ...updates }, true);
          const after = await txn.update(t, String(pk), updates);
          touched.push({ t, op: 'update', pk: String(pk), before, after });
          return after;
        },
        async delete(t, pk) {
          const before = { ...self.storage.getRow(t, String(pk)) };
          await txn.delete(t, String(pk));
          touched.push({ t, op: 'delete', pk: String(pk), before });
        },
      };
      return fn(proxy);
    });
    for (const m of touched) {
      const api = this.table(m.t);
      if (m.op === 'insert') api._updateIndexesOnInsert(m.after, m.pk);
      else if (m.op === 'update') api._updateIndexesOnUpdate(m.before, m.after);
      else api._updateIndexesOnDelete(m.before, m.pk);
    }
    return result;
  }

  /**
   * Index-backed equality lookup: returns the rows whose indexed field equals key.
   * Falls back to a table scan when no hash index is registered for the column.
   */
  lookupBy(tableName, field, key) {
    const idx = this.indexes.get(`${tableName}_${field}_hash`);
    if (!idx) return this.table(tableName).find(r => r[field] === key);
    return [...idx.lookup(key)].map(pk => this.storage.getRow(tableName, pk)).filter(Boolean);
  }

  /**
   * Get an index by name.
   * @param {string} indexName
   * @returns {BTreeIndex|HashIndex}
   */
  index(indexName) {
    const idx = this.indexes.get(indexName);
    if (!idx) throw new Error(`Index '${indexName}' not found`);
    return idx;
  }

  /**
   * Graceful shutdown — flush all dirty tables, abort active transactions.
   */
  async shutdown() {
    this.txnManager.abortAll();
    this.storage.flushAll();
    this.wal.checkpoint();
    console.log('[DB] Graceful shutdown complete.');
  }
}

module.exports = Database;
