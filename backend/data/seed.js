/**
 * Idempotent seeding — runs on every boot, only fills what's missing:
 *  - product catalog (from products.json bundled in the repo)
 *  - categories derived from the catalog
 *  - the admin account (ADMIN_PHONE env, defaults to 9999999999)
 *  - home-page video banners (files copied from seed-assets/ into uploads/)
 */
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const db = require('./db');

const SEED_PRODUCTS = require('./products.json');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
const SEED_ASSETS_DIR = path.join(__dirname, '..', 'seed-assets');

const SEED_BANNERS = [
  {
    file: 'field-to-bottle.mp4',
    title: 'From our fields to your bottle',
    subtitle: 'Traceable, single-origin oils pressed the traditional way',
  },
  {
    file: 'coconut-production.mp4',
    title: 'Pure cold-pressed coconut oil',
    subtitle: 'Hand-selected copra, wood-pressed under 25°C',
  },
];

const SEED_CATEGORIES = [
  { id: 'oils', label: 'Cold-Pressed Oils', image: 'coconut-oil.jpeg' },
  { id: 'soaps', label: 'Organic Soaps', image: 'neem-soap.svg' },
  { id: 'powders', label: 'Herbal Powders', image: 'moringa-powder.svg' },
];

async function seed() {
  // Products
  if ((await db.count('products')) === 0) {
    for (const p of SEED_PRODUCTS) await db.put('products', p);
    console.log(`[seed] ${SEED_PRODUCTS.length} products`);
  }

  // Categories
  if ((await db.count('categories')) === 0) {
    let sort = 0;
    for (const c of SEED_CATEGORIES) {
      await db.put('categories', { ...c, sort: sort++ });
    }
    console.log(`[seed] ${SEED_CATEGORIES.length} categories`);
  }

  // Admin user
  const users = await db.list('users');
  if (!users.some((u) => u.role === 'admin')) {
    const adminPhone = process.env.ADMIN_PHONE || '9999999999';
    const existing = users.find((u) => u.phone === adminPhone);
    if (existing) {
      existing.role = 'admin';
      await db.put('users', existing);
    } else {
      await db.put('users', {
        id: uuid(),
        phone: adminPhone,
        name: 'Western Gods Admin',
        email: process.env.ADMIN_EMAIL || '',
        role: 'admin',
        addresses: [],
        createdAt: new Date().toISOString(),
      });
    }
    console.log(`[seed] admin user on phone ${adminPhone} (log in with OTP as usual)`);
  }

  // Seed video files: copied into UPLOADS_DIR on every boot (not gated on the
  // banner *records* existing) because the filesystem is ephemeral on Render's
  // free plan — a redeploy wipes uploads/ even though the DB rows persist in
  // Neon. Without this, existing banner records would 404 forever.
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  for (const b of SEED_BANNERS) {
    const src = path.join(SEED_ASSETS_DIR, b.file);
    const dest = path.join(UPLOADS_DIR, b.file);
    if (!fs.existsSync(dest) && fs.existsSync(src)) fs.copyFileSync(src, dest);
  }

  // Banner records: only inserted once (admin may delete/reorder them afterwards).
  if ((await db.count('banners')) === 0) {
    let sort = 0;
    for (const b of SEED_BANNERS) {
      if (fs.existsSync(path.join(UPLOADS_DIR, b.file))) {
        await db.put('banners', {
          id: uuid(),
          title: b.title,
          subtitle: b.subtitle,
          type: 'video',
          url: `/uploads/${b.file}`,
          active: true,
          sort: sort++,
          createdAt: new Date().toISOString(),
        });
      }
    }
    console.log('[seed] home-page video banners');
  }
}

module.exports = { seed, UPLOADS_DIR };
