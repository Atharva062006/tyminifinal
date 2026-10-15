/**
 * Seed deterministic demo data into Team C's DB (idempotent: skips if data already exists).
 * Use `node scripts/seed-data.js --force` after `npm run reset` to re-create everything.
 * Note: stop Team C first — two processes must not write the same data files.
 */
const path = require('path');
const Database = require(path.resolve(__dirname, '../services/team-c-placement/src/db/Database'));
const AuditService = require(path.resolve(__dirname, '../services/team-c-placement/src/services/auditService'));
const AuthService = require(path.resolve(__dirname, '../services/team-c-placement/src/services/authService'));
const NotificationService = require(path.resolve(__dirname, '../services/team-c-placement/src/services/notificationService'));
const { seed } = require(path.resolve(__dirname, '../services/team-c-placement/src/services/seedService'));

async function main() {
  const db = new Database();
  await db.initialize();
  const auditService = new AuditService(db);
  const result = await seed({
    db, auditService, authService: new AuthService(db, auditService),
    notificationService: new NotificationService(db), force: process.argv.includes('--force'),
  });
  await db.shutdown();
  console.log(result.seeded ? `Seed data loaded: ${JSON.stringify(result)}` : 'Database already has data — nothing to seed (use `npm run reset` first).');
  process.exit(0);
}

main().catch(err => { console.error('Seed failed:', err); process.exit(1); });
