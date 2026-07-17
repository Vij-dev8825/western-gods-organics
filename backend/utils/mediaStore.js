/**
 * Stores compressed images directly in the database (base64, inside the
 * same yo_media table Postgres/JSON already supports) instead of the local
 * disk — Render's free plan wipes local disk on every redeploy, which was
 * silently breaking product/category/banner photos. The database is the one
 * thing in this app that reliably persists, so images live there by default.
 * Cloudinary (if configured) is still used first when available, since it
 * adds real CDN/caching benefits — this is the fallback that always works.
 */
const sharp = require('sharp');
const { v4: uuid } = require('uuid');
const db = require('../data/db');

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 78;

/** Compresses an image buffer (resize + re-encode as JPEG) and stores it,
 * returning a URL the frontend can load directly. */
async function compressAndStore(buffer) {
  const compressed = await sharp(buffer)
    .rotate() // respect EXIF orientation before stripping metadata
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  const id = uuid();
  await db.put('media', {
    id,
    mimeType: 'image/jpeg',
    data: compressed.toString('base64'),
    createdAt: new Date().toISOString(),
  });
  return `/api/media/${id}`;
}

async function getMedia(id) {
  return db.get('media', id);
}

module.exports = { compressAndStore, getMedia };
