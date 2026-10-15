/**
 * RecoveryService — WAL recovery verification, backup and restore evidence (C4).
 *
 *   verifyRecovery : replays the WAL and reports timings.
 *   backup         : copies every table file into data/backups/<timestamp>/.
 *   verifyRestore  : loads a backup into a throw-away StorageEngine and reconciles row counts and
 *                    checksums against the live tables — the evidence for RPO / RTO.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const StorageEngine = require('../db/engine/StorageEngine');

const RPO_TARGET_SECONDS = 300;   // 5 minutes
const RTO_TARGET_SECONDS = 1800;  // 30 minutes

function checksum(rows) {
  const sorted = [...rows].map(r => JSON.stringify(r, Object.keys(r).sort())).sort();
  return crypto.createHash('sha256').update(sorted.join('\n')).digest('hex').slice(0, 16);
}

class RecoveryService {
  constructor(db) {
    this.db = db;
    this.backupRoot = path.join(db.dataDir, 'backups');
  }

  async verifyRecovery() {
    const startTime = Date.now();
    this.db.storage.flushAll();
    const replayedCount = this.db.wal.recover(this.db.storage);
    return {
      status: 'SUCCESS',
      replayed_transactions: replayedCount,
      recovery_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  backup() {
    const t0 = Date.now();
    this.db.storage.flushAll();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(this.backupRoot, stamp);
    fs.mkdirSync(path.join(dir, 'tables'), { recursive: true });
    let files = 0;
    for (const t of this.db.schema.getTableNames()) {
      const src = path.join(this.db.storage.tablesDir, `${t}.json`);
      if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(dir, 'tables', `${t}.json`)); files++; }
    }
    return { backup_id: stamp, tables_copied: files, took_ms: Date.now() - t0, created_at: new Date().toISOString() };
  }

  listBackups() {
    if (!fs.existsSync(this.backupRoot)) return [];
    return fs.readdirSync(this.backupRoot).sort().reverse().slice(0, 20);
  }

  /** Restore a backup into a scratch engine and reconcile it with the live database. */
  verifyRestore(backupId) {
    const id = backupId || this.listBackups()[0];
    if (!id) return { status: 'NO_BACKUP', message: 'Create a backup first.' };
    const dir = path.join(this.backupRoot, id);
    if (!fs.existsSync(dir)) return { status: 'NOT_FOUND', backup_id: id };

    const t0 = Date.now();
    const scratch = new StorageEngine(dir);
    scratch.initialize();
    const reconciliation = [];
    let mismatches = 0;
    for (const t of this.db.schema.getTableNames()) {
      const restored = scratch.readTable(t);
      const live = this.db.storage.readTable(t);
      const same = restored.length === live.length && checksum(restored) === checksum(live);
      if (!same) mismatches++;
      reconciliation.push({ table: t, restored_rows: restored.length, live_rows: live.length, identical: same });
    }
    const rtoSeconds = (Date.now() - t0) / 1000;
    const ageSeconds = (Date.now() - Date.parse(id.replace(/T(\d\d)-(\d\d)-(\d\d)-(\d+)Z/, 'T$1:$2:$3.$4Z'))) / 1000;
    return {
      status: 'SUCCESS',
      backup_id: id,
      reconciliation,
      tables_with_drift: mismatches,
      rto_seconds: Number(rtoSeconds.toFixed(3)),
      rto_target_seconds: RTO_TARGET_SECONDS,
      rto_met: rtoSeconds <= RTO_TARGET_SECONDS,
      rpo_seconds: Number.isFinite(ageSeconds) ? Number(ageSeconds.toFixed(1)) : null,
      rpo_target_seconds: RPO_TARGET_SECONDS,
      rpo_note: 'Every commit is fsync-flushed with a WAL entry, so the live RPO is ~0; this value is the age of the backup being verified.',
      verified_at: new Date().toISOString(),
    };
  }
}

module.exports = RecoveryService;
