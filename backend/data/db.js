/**
 * Data layer with three interchangeable backends:
 *  - Postgres (Neon) when DATABASE_URL starts with postgres:// or postgresql://
 *    → each collection is a table (id TEXT PRIMARY KEY, data JSONB, created_at).
 *  - MySQL when DATABASE_URL starts with mysql:// → same shape, adapted to
 *    MySQL syntax (id VARCHAR(255), data JSON, created_at TIMESTAMP).
 *  - JSON files in ./data when DATABASE_URL is absent → zero-setup local dev.
 *
 * All three keep the app itself free of any SQL/schema knowledge, and every
 * function is async so routes are identical across modes.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname);

const COLLECTIONS = [
  'users',
  'products',
  'categories',
  'carts',
  'wishlists',
  'orders',
  'bulk-enquiries',
  'contacts',
  'banners',
  'chat-messages',
  'notifications',
  'notification-logs',
  'reviews',
  'coupons',
  'subscriptions',
  'blog-posts',
  'blog-settings',
  'blog-comments',
  'page-banners',
  'sale-banner',
  'currency-overrides',
  'media',
  'push-subscriptions',
  'stock-notify',
  'homepage-reviews',
  'country-catalog',
];

let mode = 'json';
let pool = null;

function tableName(col) {
  return `yo_${col.replace(/-/g, '_')}`;
}

function filePath(col) {
  return path.join(DATA_DIR, `${col}.json`);
}

/* ------------------------------ JSON backend ------------------------------ */

function jsonRead(col) {
  const fp = filePath(col);
  if (!fs.existsSync(fp)) return [];
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(fp, 'utf-8') || '[]');
  } catch {
    return [];
  }
  // Legacy carts/wishlists were stored as { userId: [...] } maps — normalise.
  if (!Array.isArray(parsed)) {
    return Object.entries(parsed).map(([id, items]) => ({ id, items }));
  }
  return parsed;
}

function jsonWrite(col, rows) {
  fs.writeFileSync(filePath(col), JSON.stringify(rows, null, 2), 'utf-8');
}

/* ------------------------------- Public API ------------------------------- */

async function init() {
  const url = process.env.DATABASE_URL;
  if (url && /^mysql:\/\//i.test(url)) {
    const mysql = require('mysql2/promise');
    pool = mysql.createPool({
      uri: url,
      connectionLimit: 5,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    });
    for (const col of COLLECTIONS) {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS ${tableName(col)} (
           id VARCHAR(255) PRIMARY KEY,
           data JSON NOT NULL,
           created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`
      );
    }
    mode = 'mysql';
  } else if (url) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: url,
      max: 5,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
    });
    for (const col of COLLECTIONS) {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS ${tableName(col)} (
           id TEXT PRIMARY KEY,
           data JSONB NOT NULL,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      );
    }
    mode = 'postgres';
  } else {
    for (const col of COLLECTIONS) {
      if (!fs.existsSync(filePath(col))) jsonWrite(col, []);
    }
    mode = 'json';
  }
  return mode;
}

// MySQL's JSON columns come back already-parsed via mysql2 in some configs
// and as raw strings in others — handle both rather than assume one.
function parseMysqlJson(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

async function list(col) {
  if (mode === 'mysql') {
    const [rows] = await pool.query(
      `SELECT data FROM ${tableName(col)} ORDER BY created_at ASC`
    );
    return rows.map((r) => parseMysqlJson(r.data));
  }
  if (mode === 'postgres') {
    const { rows } = await pool.query(
      `SELECT data FROM ${tableName(col)} ORDER BY created_at ASC`
    );
    return rows.map((r) => r.data);
  }
  return jsonRead(col);
}

async function get(col, id) {
  if (mode === 'mysql') {
    const [rows] = await pool.query(`SELECT data FROM ${tableName(col)} WHERE id = ?`, [id]);
    return rows[0] ? parseMysqlJson(rows[0].data) : null;
  }
  if (mode === 'postgres') {
    const { rows } = await pool.query(`SELECT data FROM ${tableName(col)} WHERE id = $1`, [id]);
    return rows[0] ? rows[0].data : null;
  }
  return jsonRead(col).find((r) => r.id === id) || null;
}

/** Upsert by obj.id (full replace of the document). */
async function put(col, obj) {
  if (!obj || !obj.id) throw new Error(`db.put(${col}): object must have an id`);
  if (mode === 'mysql') {
    await pool.query(
      `INSERT INTO ${tableName(col)} (id, data) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data)`,
      [obj.id, JSON.stringify(obj)]
    );
    return obj;
  }
  if (mode === 'postgres') {
    await pool.query(
      `INSERT INTO ${tableName(col)} (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [obj.id, JSON.stringify(obj)]
    );
    return obj;
  }
  const rows = jsonRead(col);
  const idx = rows.findIndex((r) => r.id === obj.id);
  if (idx === -1) rows.push(obj);
  else rows[idx] = obj;
  jsonWrite(col, rows);
  return obj;
}

async function remove(col, id) {
  if (mode === 'mysql') {
    await pool.query(`DELETE FROM ${tableName(col)} WHERE id = ?`, [id]);
    return;
  }
  if (mode === 'postgres') {
    await pool.query(`DELETE FROM ${tableName(col)} WHERE id = $1`, [id]);
    return;
  }
  jsonWrite(col, jsonRead(col).filter((r) => r.id !== id));
}

async function count(col) {
  if (mode === 'mysql') {
    const [rows] = await pool.query(`SELECT COUNT(*) AS n FROM ${tableName(col)}`);
    return Number(rows[0].n);
  }
  if (mode === 'postgres') {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${tableName(col)}`);
    return rows[0].n;
  }
  return jsonRead(col).length;
}

function getMode() {
  return mode;
}

module.exports = { init, list, get, put, remove, count, getMode, COLLECTIONS };
