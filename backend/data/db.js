/**
 * Data layer with two interchangeable backends:
 *  - Postgres (Neon) when DATABASE_URL is set  → each collection is a table
 *    (id TEXT PRIMARY KEY, data JSONB, created_at) so the app needs zero SQL
 *    knowledge elsewhere and can move to a fully relational schema later.
 *  - JSON files in ./data when DATABASE_URL is absent → zero-setup local dev.
 *
 * Every function is async so routes are identical in both modes.
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
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    const url = process.env.DATABASE_URL;
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

async function list(col) {
  if (mode === 'postgres') {
    const { rows } = await pool.query(
      `SELECT data FROM ${tableName(col)} ORDER BY created_at ASC`
    );
    return rows.map((r) => r.data);
  }
  return jsonRead(col);
}

async function get(col, id) {
  if (mode === 'postgres') {
    const { rows } = await pool.query(`SELECT data FROM ${tableName(col)} WHERE id = $1`, [id]);
    return rows[0] ? rows[0].data : null;
  }
  return jsonRead(col).find((r) => r.id === id) || null;
}

/** Upsert by obj.id (full replace of the document). */
async function put(col, obj) {
  if (!obj || !obj.id) throw new Error(`db.put(${col}): object must have an id`);
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
  if (mode === 'postgres') {
    await pool.query(`DELETE FROM ${tableName(col)} WHERE id = $1`, [id]);
    return;
  }
  jsonWrite(col, jsonRead(col).filter((r) => r.id !== id));
}

async function count(col) {
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
