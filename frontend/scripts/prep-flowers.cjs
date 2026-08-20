/**
 * Turns the supplied flower photographs into cut-out sprites for the pookalam.
 *
 * All fifteen arrive as JPEGs on a flat #F7F7F7 ground, which cannot simply be
 * thresholded away: the jasmine is pure white, the pansy is half white, and a
 * global "anything pale is background" rule would eat holes straight through
 * them. So the background is found by flooding inward from the border instead
 * — that only ever removes the ground the flower is sitting on, and stops at
 * the flower's own edge no matter how pale the petals are.
 *
 * Edge pixels then get partial alpha scaled by how far their colour sits from
 * the ground, which feathers the cut without blurring colour across it (a
 * plain blur would drag grey fringes into the petals).
 */
const fs = require('fs');
const path = require('path');
const path_ = require('path');
// sharp lives in the backend's dependencies; this is a build-time script, not
// something the frontend bundle ever touches.
const sharp = require(path_.join(__dirname, '..', '..', 'backend', 'node_modules', 'sharp'));

// Usage: node scripts/prep-flowers.cjs <folder of source photographs>
const SRC = process.argv[2];
const OUT = path_.join(__dirname, '..', 'public', 'flowers');

if (!SRC) {
  console.error('Usage: node scripts/prep-flowers.cjs <folder containing the flower photographs>');
  process.exit(1);
}

const BG = [247, 247, 247];
const TOL = 9;        // how close to the ground colour still counts as ground
const FEATHER = 26;   // colour distance at which a pixel becomes fully opaque
const SIZE = 220;     // sprites are never drawn bigger than ~90px, even on retina

/** id, source file, and how the flower is named on the page. */
const FLOWERS = [
  ['chendumalli',    'WhatsApp Image 2026-08-20 at 10.54.02 AM (2).jpeg'],
  ['chendumalli-deep','WhatsApp Image 2026-08-20 at 10.54.02 AM (4).jpeg'],
  ['jamanthi',       'WhatsApp Image 2026-08-20 at 10.54.03 AM (3).jpeg'],
  ['chethi',         'WhatsApp Image 2026-08-20 at 10.54.02 AM (3).jpeg'],
  ['manja-chethi',   'WhatsApp Image 2026-08-20 at 10.54.03 AM (6).jpeg'],
  ['golden-chethi',  'WhatsApp Image 2026-08-20 at 10.54.03 AM (7).jpeg'],
  ['chembarathi',    'WhatsApp Image 2026-08-20 at 10.54.03 AM.jpeg'],
  ['manja-chembarathi','WhatsApp Image 2026-08-20 at 10.54.03 AM (8).jpeg'],
  ['flame',          'WhatsApp Image 2026-08-20 at 10.54.03 AM (1).jpeg'],
  ['shankhupushpam', 'WhatsApp Image 2026-08-20 at 10.54.03 AM (2).jpeg'],
  ['vadamalli',      'WhatsApp Image 2026-08-20 at 10.54.02 AM.jpeg'],
  ['mulla',          'WhatsApp Image 2026-08-20 at 10.54.02 AM (1).jpeg'],
  ['pansy',          'WhatsApp Image 2026-08-20 at 10.54.03 AM (9).jpeg'],
  ['sooryakanthi',   'WhatsApp Image 2026-08-20 at 10.54.03 AM (4).jpeg'],
  ['thulasi',        'WhatsApp Image 2026-08-20 at 10.54.03 AM (5).jpeg'],
];

async function cutOut(id, file) {
  const src = path.join(SRC, file);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;

  const nearBg = (i) =>
    Math.abs(data[i] - BG[0]) <= TOL &&
    Math.abs(data[i + 1] - BG[1]) <= TOL &&
    Math.abs(data[i + 2] - BG[2]) <= TOL;

  // Flood inward from every border pixel. An explicit stack rather than
  // recursion — a 1.5-megapixel image would blow the call stack.
  const isGround = new Uint8Array(w * h);
  const stack = [];
  const consider = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (isGround[p]) return;
    if (!nearBg(p * c)) return;
    isGround[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { consider(x, 0); consider(x, h - 1); }
  for (let y = 0; y < h; y++) { consider(0, y); consider(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    consider(x + 1, y); consider(x - 1, y); consider(x, y + 1); consider(x, y - 1);
  }

  // Alpha, plus the flower's bounding box in the same pass.
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * c;
      if (isGround[p]) { data[i + 3] = 0; continue; }

      const touchesGround =
        (x > 0 && isGround[p - 1]) || (x < w - 1 && isGround[p + 1]) ||
        (y > 0 && isGround[p - w]) || (y < h - 1 && isGround[p + w]);
      if (touchesGround) {
        const dist = Math.max(
          Math.abs(data[i] - BG[0]), Math.abs(data[i + 1] - BG[1]), Math.abs(data[i + 2] - BG[2])
        );
        data[i + 3] = Math.min(255, Math.round((dist / FEATHER) * 255));
      } else {
        data[i + 3] = 255;
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const kept = isGround.reduce((n, v) => n + (v ? 0 : 1), 0);
  const bw = maxX - minX + 1, bh = maxY - minY + 1;

  await sharp(data, { raw: { width: w, height: h, channels: c } })
    .extract({ left: minX, top: minY, width: bw, height: bh })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 86, alphaQuality: 90, effort: 6 })
    .toFile(path.join(OUT, `${id}.webp`));

  const kb = fs.statSync(path.join(OUT, `${id}.webp`)).size / 1024;
  const keptPct = ((kept / (w * h)) * 100).toFixed(1);
  return { id, box: `${bw}x${bh}`, keptPct, kb: kb.toFixed(1) };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let total = 0;
  console.log('id                    bbox        flower%   size');
  for (const [id, file] of FLOWERS) {
    const r = await cutOut(id, file);
    total += Number(r.kb);
    console.log(`${r.id.padEnd(21)} ${r.box.padEnd(11)} ${String(r.keptPct).padStart(5)}%  ${r.kb.padStart(6)} KB`);
  }
  console.log(`\n${FLOWERS.length} sprites, ${total.toFixed(0)} KB total`);
})();
