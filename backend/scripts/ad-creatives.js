/**
 * Reformats the catalogue's product photography into the shapes Meta actually
 * serves on a phone.
 *
 *   node scripts/ad-creatives.js <folder-of-source-jpgs> <out-folder>
 *
 * The shop's photos are 1376x768 — 16:9, which is the one aspect ratio Meta
 * never gives much of the screen to. Feed wants 1:1 or 4:5, and 4:5 occupies
 * roughly twice the vertical space of a landscape frame on the same phone.
 * Same photograph, twice the presence, no reshoot.
 *
 * The product sits in the middle of a wide, near-empty frame, so a centre crop
 * to square gets the bottle and the ingredients around its base and throws away
 * only background. That crop is 768px, which is then scaled to Meta's 1080px —
 * a 1.4x upscale, which lanczos handles cleanly on photography this soft-lit.
 * The 4:5 keeps the square and extends the backdrop above and below rather than
 * stretching anything, sampling the real corner colour so the join is invisible.
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const SRC = (process.argv[2] || '').replace(/\\/g, '/').replace(/\/?$/, '/');
const OUT = (process.argv[3] || '').replace(/\\/g, '/').replace(/\/?$/, '/');
if (!SRC || !fs.existsSync(SRC) || !OUT) {
  console.error('Usage: node scripts/ad-creatives.js <src-folder> <out-folder>');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const EDGE = 1080;
const TALL = 1350; // 4:5

/** The backdrop is a soft gradient, so one corner pixel is a poor sample.
 * Average a patch instead, or the extension shows as a band. */
async function backdrop(file) {
  const { data } = await sharp(file)
    .extract({ left: 8, top: 8, width: 120, height: 120 })
    .resize(1, 1)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2] };
}

async function build(file, name) {
  const meta = await sharp(file).metadata();
  const side = Math.min(meta.width, meta.height);
  const left = Math.round((meta.width - side) / 2);
  const top = Math.round((meta.height - side) / 2);
  const bg = await backdrop(file);

  const square = await sharp(file)
    .extract({ left, top, width: side, height: side })
    .resize(EDGE, EDGE, { kernel: 'lanczos3' })
    .toBuffer();

  await sharp(square).jpeg({ quality: 90 }).toFile(`${OUT}${name}-1x1.jpg`);

  await sharp({
    create: { width: EDGE, height: TALL, channels: 3, background: bg },
  })
    .composite([{ input: square, left: 0, top: Math.round((TALL - EDGE) / 2) }])
    .jpeg({ quality: 90 })
    .toFile(`${OUT}${name}-4x5.jpg`);

  const a = Math.round(fs.statSync(`${OUT}${name}-1x1.jpg`).size / 1024);
  const b = Math.round(fs.statSync(`${OUT}${name}-4x5.jpg`).size / 1024);
  console.log(
    '  ' + name.padEnd(20),
    meta.width + 'x' + meta.height,
    '->  1:1 ' + EDGE + 'px ' + a + 'kB   4:5 ' + EDGE + 'x' + TALL + ' ' + b + 'kB',
    '  backdrop rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')'
  );
}

(async () => {
  const files = fs.readdirSync(SRC).filter((f) => /\.(jpe?g|png)$/i.test(f));
  for (const f of files) await build(SRC + f, path.basename(f, path.extname(f)));
})();
