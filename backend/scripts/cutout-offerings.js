/**
 * Cuts the Vinayagar Chaturthi offering pictures out of their white
 * backgrounds and writes them into the frontend as trimmed, transparent PNGs.
 *
 *   node scripts/cutout-offerings.js <folder-of-source-images>
 *
 * The interesting part is that it flood-fills inward from the border instead
 * of thresholding on "is this pixel white". The modakam is itself cream-white,
 * and a global threshold punches a hole straight through it; only white that
 * is *connected to the edge* is background. Re-run this if better source
 * images turn up — the frontend imports whatever it writes.
 */
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');

const SRC = (process.argv[2] || '').replace(/\\/g, '/').replace(/\/?$/, '/');
if (!SRC || SRC === '/' || !fs.existsSync(SRC)) {
  console.error('Usage: node scripts/cutout-offerings.js <folder-of-source-images>');
  process.exit(1);
}
const OUT = path.join(__dirname, '..', '..', 'frontend', 'src', 'assets', 'vinayagar') + '/';

const MAP = {
  '01-diya-lamp.png': 'deepam',
  '02-betel-leaf.png': 'betel',
  '03-coconut.png': 'coconut',
  '04-banana.png': 'banana',
  '05-kumkum-bowl.png': 'kumkum',
  '06-hibiscus-flower.png': 'hibiscus',
  '07-durva-grass.png': 'arukampul',
  '08-modak.png': 'modakam',
};

const BG = 215;  // min-channel at or above this counts as background. Low enough to
                 // take the source images own grey drop shadows with it: at 244
                 // they survived as opaque smudges that read as dirty halos on
                 // the green leaf. Verified not to leak into the cream modak —
                 // its kept area falls 44% to 41% between 244 and 215, a rim,
                 // not a hole.
const SOFT = 175; // below this stays fully opaque; between the two, feathered
const MAX = 256;

async function cut(file, name) {
  const { data, info } = await sharp(SRC + file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, n = w * h;

  const isBg = new Uint8Array(n);
  const minCh = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    minCh[i] = Math.min(data[p], data[p + 1], data[p + 2]);
  }

  // Flood fill inward from every border pixel. Only white CONNECTED to the
  // edge is background — which is what keeps the white modak intact.
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x); stack.push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w); stack.push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    if (isBg[i] || minCh[i] < BG) continue;
    isBg[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }

  // Alpha, with the rim feathered so edges aren't jagged.
  let opaque = 0, minX = w, minY = h, maxX = -1, maxY = -1;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (isBg[i]) { data[p + 3] = 0; continue; }
    const x = i % w, y = (i / w) | 0;
    const touches =
      (x > 0 && isBg[i - 1]) || (x < w - 1 && isBg[i + 1]) ||
      (y > 0 && isBg[i - w]) || (y < h - 1 && isBg[i + w]);
    if (touches && minCh[i] > SOFT) {
      data[p + 3] = Math.max(0, Math.min(255,
        Math.round((255 * (BG - minCh[i])) / (BG - SOFT))));
    }
    if (data[p + 3] > 8) {
      opaque++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }

  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  await sharp(Buffer.from(data), { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: minX, top: minY, width: bw, height: bh })
    .resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(OUT + name + '.png');

  const out = await sharp(OUT + name + '.png').metadata();
  const kb = Math.round(fs.statSync(OUT + name + '.png').size / 1024);
  console.log(
    name.padEnd(11),
    (w + 'x' + h).padEnd(9), '->', (out.width + 'x' + out.height).padEnd(9),
    'kept ' + String(Math.round((opaque / n) * 100)).padStart(3) + '%',
    kb + ' kB'
  );
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [file, name] of Object.entries(MAP)) await cut(file, name);
})();
