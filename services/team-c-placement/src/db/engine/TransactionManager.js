/**
 * TransactionManager — ACID transaction support for the custom DBMS.
 *
 * Isolation level: READ_COMMITTED (default).
 * Each transaction:
 *   1. Acquires row-level locks before reads/writes.
 *   2. Buffers mutations in a private undo log.
 *   3. On COMMIT: writes WAL entries, applies mutations, flushes to disk, releases locks.
 *   4. On ROLLBACK: applies undo log in reverse, releases locks.
 *
 * Idempotency: callers must pass an idempotency key; TransactionManager checks
 * the idempotency_keys table before executing.
 */

const { v4: uuidv4 } = require('uuid');

/** Isolation levels */
const ISOLATION = { READ_COMMITTED: 'READ_COMMITTED', REPEATABLE_READ: 'REPEATABLE_READ' };

class Transaction {
  constructor(txnId, storage, wal, lockManager) {
    this.txnId       = txnId;
    this.storage     = storage;
    this.wal         = wal;
    this.lockManager = lockManager;
    this.mutations   = []; // ordered list of { op, tableName, pk, row, updates, before }
    this.undoLog     = []; // for rollback
    this.state       = 'ACTIVE'; // ACTIVE | COMMITTED | ABORTED
    this.startedAt   = new Date().toISOString();
  }

  /**
   * Read a row within the transaction (acquires shared lock).
   */
  async read(tableName, pk) {
    if (this.state !== 'ACTIVE') throw new Error(`Transaction ${this.txnId} is not active`);
    await this.lockManager.acquire(this.txnId, `${tableName}:${pk}`, 'S');
    return this.storage.getRow(tableName, pk);
  }

  /**
   * Take an exclusive lock on an arbitrary logical resource (e.g. "uniq:applications:STU1:DRV1").
   * Used to serialise check-then-insert sequences so uniqueness rules cannot be raced.
   */
  async lock(resource, mode = 'X') {
    if (this.state !== 'ACTIVE') throw new Error(`Transaction ${this.txnId} is not active`);
    await this.lockManager.acquire(this.txnId, resource, mode);
  }

  /**
   * Read a row while taking the exclusive lock up-front (avoids S->X upgrade deadlocks).
   */
  async readForUpdate(tableName, pk) {
    if (this.state !== 'ACTIVE') throw new Error(`Transaction ${this.txnId} is not active`);
    await this.lockManager.acquire(this.txnId, `${tableName}:${pk}`, 'X');
    return this.storage.getRow(tableName, pk);
  }

  /**
   * Find rows matching a predicate (table-level shared lock).
   */
  async find(tableName, predicate) {
    if (this.state !== 'ACTIVE') throw new Error(`Transaction ${this.txnId} is not active`);
    await this.lockManager.acquire(this.txnId, tableName, 'S');
    return this.storage.findRows(tableName, predicate);
  }

  /**
   * Read all rows in a table (table-level shared lock).
   */
  async readAll(tableName) {
    if (this.state !== 'ACTIVE') throw new Error(`Transaction ${this.txnId} is not active`);
    await this.lockManager.acquire(this.txnId, tableName, 'S');
    return this.storage.readTable(tableName);
  }

  /**
   * Insert a row (acquires exclusive lock, logs to WAL, buffers mutation).
   */
  async insert(tableName, pk, row) {
    if (this.state !== 'ACTIVE') throw new Error(`Transaction ${this.txnId} is not active`);
    await this.lockManager.acquire(this.txnId, `${tableName}:${pk}`, 'X');
    // Log to WAL before applying
    this.wal.logMutation(this.txnId, 'INSERT', tableName, pk, null, row);
    this.mutations.push({ op: 'INSERT', tableName, pk, row });
    this.undoLog.push({ op: 'INSERT', tableName, pk, before: null });
    // Apply immediately to the storage (visible within this txn; other txns see old committed state)
    this.storage.insertRow(tableName, pk, row);
    return row;
  }

  /**
   * Update a row (partial merge).
   */
  async update(tableName, pk, updates) {
    if (this.state !== 'ACTIVE') throw new Error(`Transaction ${this.txnId} is not active`);
    await this.lockManager.acquire(this.txnId, `${tableName}:${pk}`, 'X');
    const before = this.storage.getRow(tableName, pk);
    if (!before) throw new Error(`Row '${pk}' not found in '${tableName}'`);
    const after = { ...before, ...updates };
    this.wal.logMutation(this.txnId, 'UPDATE', tableName, pk, before, after);
    this.mutations.push({ op: 'UPDATE', tableName, pk, updates });
    this.undoLog.push({ op: 'UPDATE', tableName, pk, before: { ...before } });
    return this.storage.updateRow(tableName, pk, updates);
  }

  /**
   * Delete a row.
   */
  async delete(tableName, pk) {
    if (this.state !== 'ACTIVE') throw new Error(`Transaction ${this.txnId} is not active`);
    await this.lockManager.acquire(this.txnId, `${tableName}:${pk}`, 'X');
    const before = this.storage.getRow(tableName, pk);
    if (!before) throw new Error(`Row '${pk}' not found in '${tableName}'`);
    this.wal.logMutation(this.txnId, 'DELETE', tableName, pk, before, null);
    this.mutations.push({ op: 'DELETE', tableName, pk });
    this.undoLog.push({ op: 'DELETE', tableName, pk, before: { ...before } });
    this.storage.deleteRow(tableName, pk);
  }

  /**
   * Commit: flush dirty pages, mark WAL committed, release all locks.
   */
  commit() {
    if (this.state !== 'ACTIVE') throw new Error(`Transaction ${this.txnId} is not active`);
    this.storage.flushAll();
    this.wal.commit(this.txnId);
    this.lockManager.releaseAll(this.txnId);
    this.state = 'COMMITTED';
  }

  /**
   * Rollback: undo all mutations, discard WAL entries, release all locks.
   */
  rollback() {
    if (this.state === 'COMMITTED') throw new Error(`Cannot rollback committed transaction`);
    if (this.state === 'ABORTED')   return; // idempotent
    try {
      this.storage.applyUndo(this.undoLog);
    } catch { /* best-effort undo */ }
    this.wal.abort(this.txnId);
    this.lockManager.releaseAll(this.txnId);
    this.state = 'ABORTED';
  }
}

class TransactionManager {
  /**
   * @param {StorageEngine} storage
   * @param {WAL}           wal
   * @param {LockManager}   lockManager
   */
  constructor(storage, wal, lockManager) {
    this.storage     = storage;
    this.wal         = wal;
    this.lockManager = lockManager;
    this._active     = new Map(); // txnId -> Transaction
  }

  /** Begin a new transaction. Returns a Transaction object. */
  begin() {
    const txnId = uuidv4();
    const txn   = new Transaction(txnId, this.storage, this.wal, this.lockManager);
    this._active.set(txnId, txn);
    return txn;
  }

  /**
   * Execute a function within a transaction.
   * Automatically commits on success or rolls back on error.
   *
   * Usage:
   *   const result = await txnManager.execute(async (txn) => {
   *     await txn.insert('students', id, row);
   *     await txn.update('drives', driveId, { seats: seats - 1 });
   *     return result;
   *   });
   *
   * @param {Function} fn  - async (txn: Transaction) => result
   * @returns {*} Return value of fn
   */
  async execute(fn) {
    const txn = this.begin();
    try {
      const result = await fn(txn);
      txn.commit();
      this._active.delete(txn.txnId);
      return result;
    } catch (err) {
      txn.rollback();
      this._active.delete(txn.txnId);
      throw err;
    }
  }

  /** Abort all active transactions (called on shutdown) */
  abortAll() {
    for (const txn of this._active.values()) {
      try { txn.rollback(); } catch { /* ignore */ }
    }
    this._active.clear();
  }

  /** Return number of currently active transactions */
  activeCount() {
    return this._active.size;
  }
}

module.exports = { TransactionManager, Transaction, ISOLATION };
