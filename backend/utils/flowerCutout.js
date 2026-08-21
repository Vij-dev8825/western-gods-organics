/**
 * Turns an uploaded flower photograph into a cut-out sprite.
 *
 * This is the same routine that prepared the original fifteen, moved onto the
 * server so the shop can add a flower without anyone running a script. The
 * photographs it is built for are the ordinary product-cutout kind: one bloom,
 * shot square on a flat pale ground.
 *
 * The background is found by flooding inward from the border, never by asking
 * "is this pixel pale?". That distinction is the whole thing: a jasmine is pure
 * white and a pansy is half white, and a brightness threshold would eat holes
 * straight through both. Flooding can only ever remove ground that the flower
 * is sitting on, because it stops the moment it meets the flower's edge.
 *
 * Edge pixels then take partial alpha scaled by how far their colour sits from
 * the ground, which feathers the cut without blurring colour across it — a
 * plain blur drags grey fringes into the petals and they show up as a dirty
 * halo the moment the sprite is put on a dark mat.
 */
const sharp = require('sharp');

/** Sprites are never drawn larger than about 90px, even on a retina phone. */
const SIZE = 220;
/** How close to the ground colour still counts as ground. */
const TOL = 12;
/** Colour distance at which an edge pixel becomes fully opaque. */
const FEATHER = 26;
/** Refuse anything where the flood ate nearly everything or nearly nothing —
 *  both mean the photograph was not the kind this can handle, and a silent
 *  bad sprite is worse than an error the shop can read. */
const MIN_KEPT = 0.04;
const MAX_KEPT = 0.97;

/**
 * @param {Buffer} input  the uploaded image
 * @returns {Promise<{ buffer: Buffer, keptPct: number, width: number, height: number }>}
 * @throws  {Error} with a message written for the person who uploaded it
 */
async function cutOutFlower(input, { size = SIZE, fit = 'contain' } = {}) {
  const { data, info } = await sharp(input)
    // Big camera files would make the flood fill needlessly slow; nothing here
    // needs more than a couple of megapixels to find an edge.
    .resize(1400, 1400, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels: c } = info;
  if (!w || !h) throw new Error('That file could not be read as an image.');

  /* The ground colour is taken from the corners rather than assumed white —
     these photographs are usually on a very pale grey, and assuming #FFFFFF
     would leave a one-pixel frame of background around every sprite. */
  const corner = (x, y) => {
    const i = (y * w + x) * c;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const corners = [corner(0, 0), corner(w - 1, 0), corner(0, h - 1), corner(w - 1, h - 1)];
  const bg = [0, 1, 2].map((k) => Math.round(corners.reduce((s, p) => s + p[k], 0) / corners.length));

  const nearBg = (i) =>
    Math.abs(data[i] - bg[0]) <= TOL &&
    Math.abs(data[i + 1] - bg[1]) <= TOL &&
    Math.abs(data[i + 2] - bg[2]) <= TOL;

  /* Flood inward from every border pixel, with an explicit stack — recursion
     would blow the call stack on a two-megapixel image. */
  const isGround = new Uint8Array(w * h);
  const stack = [];
  const consider = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (isGround[p] || !nearBg(p * c)) return;
    isGround[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { consider(x, 0); consider(x, h - 1); }
  for (let y = 0; y < h; y++) { consider(0, y); consider(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p / w) | 0;
    consider(x + 1, y); consider(x - 1, y); consider(x, y + 1); consider(x, y - 1);
  }

  /* Alpha and the flower's bounding box in one pass. */
  let minX = w, minY = h, maxX = -1, maxY = -1, kept = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p * c;
      if (isGround[p]) { data[i + 3] = 0; continue; }
      kept++;

      const touchesGround =
        (x > 0 && isGround[p - 1]) || (x < w - 1 && isGround[p + 1]) ||
        (y > 0 && isGround[p - w]) || (y < h - 1 && isGround[p + w]);
      if (touchesGround) {
        const dist = Math.max(
          Math.abs(data[i] - bg[0]), Math.abs(data[i + 1] - bg[1]), Math.abs(data[i + 2] - bg[2])
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

  const keptPct = kept / (w * h);
  if (keptPct > MAX_KEPT) {
    throw new Error(
      'No background could be found around the edges. This needs a photo of one flower on a plain pale background.'
    );
  }
  if (keptPct < MIN_KEPT || maxX < 0) {
    throw new Error('Almost the whole picture looked like background. Try one with more contrast behind the flower.');
  }

  const buffer = await sharp(data, { raw: { width: w, height: h, channels: c } })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    /* Flowers stay square-padded: the pookalam places them in fixed square
       slots. A figure uses 'inside' instead, because a person padded into a
       square is a person standing in a lot of empty air. */
    .resize(size, size, fit === 'contain'
      ? { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
      : { fit: 'inside' })
    .webp({ quality: 86, alphaQuality: 90, effort: 6 })
    .toBuffer();

  return { buffer, keptPct, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * True when the image already carries real transparency.
 *
 * Artwork bought or commissioned usually arrives as a PNG that has already
 * been cut out. Running the flood fill over it would be pointless at best and
 * destructive at worst — the "background" it would look for is not there, and
 * the corner samples it takes its ground colour from are fully transparent.
 * Sampled rather than exhaustive: a hundred thousand pixels is plenty to know
 * whether a picture has a transparent corner.
 */
async function hasTransparency(input) {
  const meta = await sharp(input).metadata();
  if (!meta.hasAlpha) return false;
  const { data, info } = await sharp(input)
    .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let clear = 0;
  for (let i = 3; i < data.length; i += info.channels) if (data[i] < 16) clear++;
  // A stray anti-aliased pixel is not a cut-out; a real one is mostly air.
  return clear / (data.length / info.channels) > 0.05;
}

/**
 * Prepares a supplied figure — a character, a mascot, anything that is not a
 * flower — for use as a sprite.
 *
 * Taller than the flower size because these are whole figures rather than
 * blooms, and passed straight through when the file is already transparent.
 */
async function prepareCharacter(input, { size = 340 } = {}) {
  if (await hasTransparency(input)) {
    const buffer = await sharp(input)
      .trim({ threshold: 1 })
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88, alphaQuality: 92, effort: 6 })
      .toBuffer();
    return { buffer, keptPct: 1, alreadyCut: true };
  }
  const cut = await cutOutFlower(input, { size, fit: 'inside' });
  return { ...cut, alreadyCut: false };
}

module.exports = { cutOutFlower, prepareCharacter, hasTransparency, SIZE };
