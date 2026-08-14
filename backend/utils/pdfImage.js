/**
 * Turns a stored image URL into bytes PDFKit can draw.
 *
 * The app keeps images in three different places depending on how it was
 * deployed — inside the database as base64, on local disk, or on Cloudinary —
 * and a PDF cannot be handed a URL. This resolves all three, preferring a
 * local read so building an invoice never waits on the network.
 *
 * Never throws. A logo that has gone missing, or one saved in a format PDFKit
 * cannot draw, must not stop a customer's bill being produced — the document
 * is worth far more than the picture at the top of it.
 */
const fs = require('fs');
const path = require('path');
const db = require('./../data/db');
const { UPLOADS_DIR } = require('./../data/seed');

/** PDFKit draws PNG and JPEG only. Anything else — SVG, WebP, HEIC — throws
 *  inside doc.image(), so it is rejected here where the failure is harmless. */
function isDrawable(buffer) {
  if (!buffer || buffer.length < 4) return false;
  const png = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  return png || jpeg;
}

async function loadImage(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    let buffer = null;

    if (url.startsWith('/api/media/')) {
      const id = url.split('/').pop().split('?')[0];
      const media = await db.get('media', id);
      if (media?.data) buffer = Buffer.from(media.data, 'base64');
    } else if (url.startsWith('/uploads/')) {
      // basename() on purpose: this value comes from stored settings, and a
      // path with ../ in it must not be able to read outside the uploads dir.
      const file = path.join(UPLOADS_DIR, path.basename(url.split('?')[0]));
      if (fs.existsSync(file)) buffer = fs.readFileSync(file);
    } else if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) buffer = Buffer.from(await res.arrayBuffer());
    }

    return isDrawable(buffer) ? buffer : null;
  } catch (err) {
    console.error('[pdfImage] could not load', url, '—', err.message);
    return null;
  }
}

/**
 * The site's own logo, rasterised from frontend/src/assets/logo.svg and
 * committed as a PNG because PDFKit cannot draw an SVG and rendering one on
 * the server would depend on fonts the host may not have.
 *
 * It is the default rather than a fallback of last resort: an invoice should
 * carry the brand the customer just bought from without anyone having to go
 * and upload anything, and a shop that has a better scan of its printed logo
 * can still override it in Admin → Invoice.
 */
const DEFAULT_LOGO_PATH = path.join(__dirname, '..', 'assets', 'invoice-logo.png');
let defaultLogoCache;

function defaultLogo() {
  if (defaultLogoCache === undefined) {
    try {
      defaultLogoCache = fs.readFileSync(DEFAULT_LOGO_PATH);
    } catch (err) {
      console.error('[pdfImage] bundled logo missing —', err.message);
      defaultLogoCache = null;
    }
  }
  return defaultLogoCache;
}

/** The logo to print on a document: whatever the shop uploaded, else ours. */
async function loadBrandLogo(settings) {
  return (await loadImage(settings && settings.logoImage)) || defaultLogo();
}

/** Draws an image scaled to fit a box, top-left anchored, and reports the
 *  height it actually used so the caller can carry on down the page. Returns 0
 *  when there was nothing to draw, which is also the right answer for the
 *  layout — the header then falls back to text and closes the gap.
 *
 *  Measured rather than assumed: a wide wordmark fits the box on width long
 *  before it reaches the full height, and reserving the whole box would leave
 *  a visible hole under it. Never enlarged past its natural size either — a
 *  small logo stretched to fill the box prints blurred. */
function drawFitted(doc, buffer, { x, y, maxWidth, maxHeight }) {
  if (!buffer) return 0;
  try {
    const img = doc.openImage(buffer);
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
    const width = img.width * scale;
    const height = img.height * scale;
    doc.image(img, x, y, { width, height });
    return height;
  } catch (err) {
    console.error('[pdfImage] could not draw an image —', err.message);
    return 0;
  }
}

module.exports = { loadImage, loadBrandLogo, drawFitted, isDrawable };
