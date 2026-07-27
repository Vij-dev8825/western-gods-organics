/**
 * One-off script: copies every row from the existing Postgres (Neon)
 * database into a MySQL database, preserving ids and created_at
 * timestamps exactly. Safe to re-run — uses the same upsert
 * (ON DUPLICATE KEY UPDATE) semantics as data/db.js itself, so running
 * it again just re-syncs anything that changed since the last run.
 *
 * Usage:
 *   SOURCE_DATABASE_URL=postgres://... TARGET_DATABASE_URL=mysql://... node scripts/migrate-to-mysql.js
 */
const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const { COLLECTIONS } = require('../data/db');

function tableName(col) {
  return `yo_${col.replace(/-/g, '_')}`;
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL;
  if (!sourceUrl || !targetUrl) {
    console.error('Set both SOURCE_DATABASE_URL (Postgres) and TARGET_DATABASE_URL (MySQL) env vars.');
    process.exit(1);
  }
  if (!/^postgres/.test(sourceUrl)) {
    console.error('SOURCE_DATABASE_URL must be a postgres:// URL.');
    process.exit(1);
  }
  if (!/^mysql:\/\//.test(targetUrl)) {
    console.error('TARGET_DATABASE_URL must be a mysql:// URL.');
    process.exit(1);
  }

  const pgPool = new Pool({
    connectionString: sourceUrl,
    ssl: /localhost|127\.0\.0\.1/.test(sourceUrl) ? false : { rejectUnauthorized: false },
  });
  // Shared hosting (e.g. MilesWeb) commonly disables TCP for MySQL entirely —
  // only a local Unix socket connection is accepted, even from 127.0.0.1.
  let mysqlPool;
  if (/localhost|127\.0\.0\.1/.test(targetUrl)) {
    const parsed = new URL(targetUrl);
    mysqlPool = mysql.createPool({
      socketPath: '/run/mysqld/mysqld.sock',
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
      connectionLimit: 5,
    });
  } else {
    mysqlPool = mysql.createPool({ uri: targetUrl, connectionLimit: 5, ssl: { rejectUnauthorized: false } });
  }

  let totalRows = 0;
  for (const col of COLLECTIONS) {
    const table = tableName(col);

    // Mirrors the schema data/db.js itself would create.
    await mysqlPool.query(
      `CREATE TABLE IF NOT EXISTS ${table} (
         id VARCHAR(255) PRIMARY KEY,
         data JSON NOT NULL,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       )`
    );

    const { rows } = await pgPool.query(
      `SELECT id, data, created_at FROM ${table} ORDER BY created_at ASC`
    );

    for (const row of rows) {
      await mysqlPool.query(
        `INSERT INTO ${table} (id, data, created_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data), created_at = VALUES(created_at)`,
        [row.id, JSON.stringify(row.data), row.created_at]
      );
    }

    console.log(`${col}: migrated ${rows.length} row(s)`);
    totalRows += rows.length;
  }

  console.log(`\nDone — ${totalRows} total row(s) migrated across ${COLLECTIONS.length} collections.`);
  await pgPool.end();
  await mysqlPool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
