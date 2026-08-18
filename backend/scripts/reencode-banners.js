/**
 * Re-encodes the home-page banner videos already in the database at the
 * settings the banner upload route now uses (BANNER_VIDEO_MAX_HEIGHT /
 * BANNER_VIDEO_BITRATE in utils/mediaStore.js).
 *
 * Changing those constants only affects the next upload. These clips were
 * stored earlier at 720p and are what the home page actually serves today —
 * three of them, roughly 1.2 MB each, silent and looping behind a dark
 * overlay. Measured on a real one: 1290 KB at 720p becomes 521 KB at 480p,
 * and 854px wide is still more than the ~750 device pixels a phone gives it.
 *
 * Rewrites each row in place, keeping the same media id, so no banner record
 * needs editing and nothing 404s while it runs.
 *
 * Only banners. Pressing and seller clips keep their audio and their higher
 * bitrate deliberately: someone talking through how the oil is made is the
 * thing being watched, not decoration.
 *
 * Usage:
 *   node scripts/reencode-banners.js --dry-run    # report only, writes nothing
 *   node scripts/reencode-banners.js              # do it
 */
require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const db = require('../data/db');
const { BANNER_VIDEO_MAX_HEIGHT, BANNER_VIDEO_BITRATE } = require('../utils/mediaStore');

ffmpeg.setFfmpegPath(ffmpegPath);

const DRY_RUN = process.argv.includes('--dry-run');
const kb = (n) => Math.round(n / 1024);

function encode(input, output) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoCodec('libx264')
      .noAudio()
      .videoFilters(`scale=-2:'min(${BANNER_VIDEO_MAX_HEIGHT},ih)'`)
      .videoBitrate(BANNER_VIDEO_BITRATE)
      .outputOptions(['-preset veryfast', '-movflags +faststart'])
      .output(output)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

async function main() {
  await db.init();

  // Without init() picking up DATABASE_URL the db module falls back to the
  // JSON files on disk, and this would rewrite the wrong store while
  // reporting success.
  const mode = db.getMode();
  console.log('db mode:', mode);
  if (mode !== 'mysql') {
    console.error(`ABORT: expected mysql, got ${mode}. Nothing written.`);
    process.exit(1);
  }
  console.log(`target: ${BANNER_VIDEO_MAX_HEIGHT}p @ ${BANNER_VIDEO_BITRATE}${DRY_RUN ? '   [DRY RUN]' : ''}\n`);

  const banners = await db.list('banners');
  const ids = banners
    .filter((b) => b.type === 'video' && typeof b.url === 'string' && b.url.startsWith('/api/media/'))
    .map((b) => b.url.replace('/api/media/', ''));

  if (!ids.length) {
    console.log('No banner videos stored in the database. Nothing to do.');
    return;
  }
  console.log(`found ${ids.length} banner video(s)\n`);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'wgo-banner-'));
  let saved = 0;

  try {
    for (const id of ids) {
      const row = await db.get('media', id);
      if (!row || !String(row.mimeType).startsWith('video/')) {
        console.log(`  ${id.slice(0, 8)}…  skipped (not a stored video)`);
        continue;
      }

      const before = Buffer.from(row.data, 'base64');
      const inPath = path.join(work, `${id}.mp4`);
      const outPath = path.join(work, `${id}-out.mp4`);
      fs.writeFileSync(inPath, before);

      await encode(inPath, outPath);
      const after = fs.readFileSync(outPath);

      // Never make a file bigger. A clip that was already lean, or was
      // uploaded after this change, is left exactly as it is.
      if (after.length >= before.length) {
        console.log(`  ${id.slice(0, 8)}…  ${kb(before.length)} KB -> would be ${kb(after.length)} KB, left alone`);
        continue;
      }

      if (!DRY_RUN) await db.put('media', { ...row, data: after.toString('base64') });
      saved += before.length - after.length;
      console.log(
        `  ${id.slice(0, 8)}…  ${kb(before.length)} KB -> ${kb(after.length)} KB` +
          `   (${Math.round((1 - after.length / before.length) * 100)}% smaller)` +
          (DRY_RUN ? '   [not written]' : '')
      );
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }

  const mb = Math.round((saved / 1024 / 1024) * 100) / 100;
  console.log(`\ntotal saved: ${mb} MB${DRY_RUN ? '   [DRY RUN — nothing written]' : ''}`);
  if (!DRY_RUN && saved > 0) {
    console.log('Banner ids are unchanged, so the home page picks these up on its next load.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
