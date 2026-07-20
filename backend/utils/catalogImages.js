/**
 * Resolves a product's `image` field (a bundled asset filename, an
 * `/api/media/:id` reference, an `/uploads/...` path, or a full URL) to
 * either a public URL (for the WhatsApp/Meta CSV feed) or raw image bytes
 * (for the PDF catalog, which embeds images directly).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { getMedia } = require('./mediaStore');

const CATALOG_IMAGES_DIR = path.join(__dirname, '..', 'public', 'catalog-images');

// Bundled seed-catalog images ship as frontend assets with a stable filename
// but no stable *build* URL (Vite hashes them). server.js instead serves a
// fixed copy of the same images from backend/public/catalog-images — the SVG
// icon products are pre-rasterized to PNG there, since neither Meta's feed
// nor pdfkit can embed SVG directly.
const CATALOG_IMAGE_FILENAMES = {
  'castor-oil.jpeg': 'castor-oil.jpeg',
  'coconut-oil.jpeg': 'coconut-oil.jpeg',
  'sesame-oil.jpeg': 'sesame-oil.jpeg',
  'groundnut-oil.jpeg': 'groundnut-oil.jpeg',
  'neem-soap.svg': 'neem-soap.png',
  'turmeric-soap.svg': 'turmeric-soap.png',
  'moringa-powder.svg': 'moringa-powder.png',
  'amla-powder.svg': 'amla-powder.png',
};

const DEFAULT_IMAGE = 'castor-oil.jpeg';

/** Resolves a product's `image` field to a publicly reachable URL. */
function resolveImageLink(image, siteUrl) {
  if (!image) return `${siteUrl}/catalog-images/${DEFAULT_IMAGE}`; // matches the frontend's own fallback
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith('/uploads/') || image.startsWith('/api/media/')) return `${siteUrl}${image}`;
  const staticName = CATALOG_IMAGE_FILENAMES[image];
  if (staticName) return `${siteUrl}/catalog-images/${staticName}`;
  return null; // unknown filename — caller decides how to warn/skip
}

function isPlaceholderIllustration(image) {
  return Boolean(image && CATALOG_IMAGE_FILENAMES[image]?.endsWith('.png'));
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    client
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(fetchBuffer(res.headers.location));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Fetching ${url} failed with status ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

/** Resolves a product's `image` field to raw image bytes, for embedding (PDF). */
async function resolveImageBuffer(image, uploadsDir) {
  const target = image || DEFAULT_IMAGE;

  if (target.startsWith('/api/media/')) {
    const media = await getMedia(target.replace('/api/media/', ''));
    return media ? Buffer.from(media.data, 'base64') : null;
  }
  if (target.startsWith('/uploads/') && uploadsDir) {
    const filePath = path.join(uploadsDir, target.replace('/uploads/', ''));
    return fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
  }
  if (/^https?:\/\//i.test(target)) {
    try {
      return await fetchBuffer(target);
    } catch {
      return null;
    }
  }
  const filename = CATALOG_IMAGE_FILENAMES[target] || CATALOG_IMAGE_FILENAMES[DEFAULT_IMAGE];
  const filePath = path.join(CATALOG_IMAGES_DIR, filename);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
}

module.exports = {
  CATALOG_IMAGE_FILENAMES,
  CATALOG_IMAGES_DIR,
  resolveImageLink,
  resolveImageBuffer,
  isPlaceholderIllustration,
};
