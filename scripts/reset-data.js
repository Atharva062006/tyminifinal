/**
 * Wipe Team C's runtime data (tables, WAL, schema version, backups) so the next start re-seeds demo data.
 * Usage: node scripts/reset-data.js
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(__dirname, '../services/team-c-placement/data');
for (const sub of ['tables', 'wal', 'backups']) {
  const dir = path.join(dataDir, sub);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}
const versionFile = path.join(dataDir, 'schema_version.json');
if (fs.existsSync(versionFile)) fs.rmSync(versionFile);
console.log('Team C data cleared. It will be re-seeded with demo data on next start (npm run start:all).');
