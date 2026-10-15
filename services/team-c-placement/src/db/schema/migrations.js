/**
 * Migrations — Schema versioning for the custom DBMS.
 *
 * Each migration is a named function that receives the Database instance
 * and performs structural changes (e.g., creating tables, adding columns).
 *
 * The migration state is persisted in data/schema_version.json.
 */

const migrations = [
  {
    version: 1,
    name: 'initial_schema',
    description: 'Create all core tables',
    up: async (db) => {
      const tables = [
        'students', 'companies', 'drives', 'applications',
        'eligibility_decisions', 'offers', 'audit_log', 'idempotency_keys',
      ];
      for (const table of tables) {
        db.storage.createTableIfNotExists(table);
      }
      console.log('[Migration v1] All tables created.');
    },
  },
  {
    version: 2,
    name: 'auth_notifications_interviews',
    description: 'Add users, announcements, notifications and interviews tables',
    up: async (db) => {
      for (const table of ['users', 'announcements', 'notifications', 'interviews']) {
        db.storage.createTableIfNotExists(table);
      }
      console.log('[Migration v2] users / announcements / notifications / interviews created.');
    },
  },
  {
    version: 3,
    name: 'drive_seats_total',
    description: 'Backfill drives.seats_total (original capacity) so remaining seats can be tracked',
    up: async (db) => {
      const holding = ['SELECTED', 'OFFER_ISSUED', 'OFFER_ACCEPTED'];
      for (const d of db.storage.readTable('drives')) {
        if (d.seats_total == null) {
          const used = db.storage.readTable('applications').filter(a => a.drive_id === d.drive_id && holding.includes(a.state)).length;
          db.storage.updateRow('drives', d.drive_id, { seats_total: d.seats + used });
        }
      }
      db.storage.flushAll();
      console.log('[Migration v3] drives.seats_total backfilled.');
    },
  },
  // Future migrations:
  // {
  //   version: 2,
  //   name: 'add_ranking_id_to_applications',
  //   up: async (db) => { ... }
  // },
];

module.exports = { migrations };
