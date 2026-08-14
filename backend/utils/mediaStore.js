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
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuid } = require('uuid');
const db = require('../data/db');

ffmpeg.setFfmpegPath(ffmpegPath);

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 78;

const VIDEO_MAX_HEIGHT = 720;
const VIDEO_BITRATE = '1200k';
const VIDEO_MAX_OUTPUT_BYTES = 20 * 1024 * 1024; // 20 MB — keeps DB rows and page loads reasonable

// Poster stills stand in for a video until it has buffered, so they're tuned
// for arriving fast rather than looking pristine — they sit behind the hero's
// dark overlay and are replaced by the real frame within a second or two.
const POSTER_ID_SUFFIX = '-poster';
const POSTER_SEEK_SECONDS = 1;
const POSTER_WIDTH = 1280;
const POSTER_QUALITY = 62;

/** Compresses an image buffer (resize + re-encode as JPEG) and stores it,
 * returning a URL the frontend can load directly.
 *
 * preserveAlpha: JPEG has no alpha channel, so re-encoding a transparent image
 * as one fills the transparent area with black. That is invisible for a photo
 * and fatal for a logo, which is almost always a transparent PNG and would
 * otherwise print as a black rectangle at the top of every invoice. Callers
 * that are storing a mark rather than a photograph opt in, and pay for it in
 * row size only when the source actually has transparency. */
async function compressAndStore(buffer, { preserveAlpha = false } = {}) {
  const resized = sharp(buffer)
    .rotate() // respect EXIF orientation before stripping metadata
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true });

  const transparent = preserveAlpha && (await sharp(buffer).metadata()).hasAlpha;
  const mimeType = transparent ? 'image/png' : 'image/jpeg';
  const compressed = transparent
    ? await resized.png({ compressionLevel: 9, palette: true }).toBuffer()
    : await resized.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();

  const id = uuid();
  await db.put('media', {
    id,
    mimeType,
    data: compressed.toString('base64'),
    createdAt: new Date().toISOString(),
  });
  return `/api/media/${id}`;
}

/** Transcodes a video file to a size-capped, muted-friendly web MP4 (720p
 * max, H.264/no-audio since banner videos always autoplay muted) and stores
 * it the same way as images. Throws if the result is still too large for a
 * database row — the fix there is a shorter/lower-res source clip. */
/** keepAudio: home-page banners are silent decoration so they drop the audio
 * track (smaller file, and autoplay would be muted anyway). A seller's product
 * clip is the opposite — often someone talking through how they make it — so
 * that caller opts back in.
 *
 * bitrate/maxBytes are overridable because not every clip on this site is a
 * hero banner. A phone video shot at the mill is watched in a notification on
 * a village 4G connection, where a smaller file that starts instantly beats a
 * sharper one that buffers — and where a fat base64 row risks running past
 * MySQL's max_allowed_packet on shared hosting. */
async function compressVideoAndStore(
  inputPath,
  { keepAudio = false, bitrate = VIDEO_BITRATE, maxBytes = VIDEO_MAX_OUTPUT_BYTES } = {}
) {
  const outputPath = path.join(os.tmpdir(), `${uuid()}.mp4`);
  await new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath).videoCodec('libx264');
    if (keepAudio) command.audioCodec('aac').audioBitrate('96k');
    else command.noAudio();
    command
      .videoFilters(`scale=-2:'min(${VIDEO_MAX_HEIGHT},ih)'`)
      .videoBitrate(bitrate)
      .outputOptions(['-preset veryfast', '-movflags +faststart'])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  const buffer = fs.readFileSync(outputPath);
  fs.unlink(outputPath, () => {});

  if (buffer.length > maxBytes) {
    const mb = (buffer.length / (1024 * 1024)).toFixed(1);
    throw new Error(`Compressed video is still ${mb} MB — please upload a shorter clip (10-20 seconds works best).`);
  }

  const id = uuid();
  await db.put('media', {
    id,
    mimeType: 'video/mp4',
    data: buffer.toString('base64'),
    createdAt: new Date().toISOString(),
  });
  return `/api/media/${id}`;
}

async function getMedia(id) {
  return db.get('media', id);
}

/**
 * Returns a still frame from a stored video as a small JPEG, generating it on
 * first request and reusing it forever after.
 *
 * A hero <video> shows nothing at all until enough of the clip has buffered,
 * which on a slow connection is seconds of blank screen. A poster fills that
 * gap for ~2% of the bytes. Deriving it here rather than at upload time means
 * videos already in the database get one too, with no migration and nothing
 * for an admin to redo.
 *
 * The derived row's id is the video's id with a suffix, so the lookup is a
 * plain primary-key read — no scanning, and no second column to index.
 * Returns null if the id isn't a video, so callers can 404 honestly.
 */
async function getVideoPoster(videoId) {
  const posterId = `${videoId}${POSTER_ID_SUFFIX}`;
  const cached = await db.get('media', posterId);
  if (cached) return cached;

  const video = await db.get('media', videoId);
  if (!video || !String(video.mimeType).startsWith('video/')) return null;

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wgo-poster-'));
  const videoPath = path.join(workDir, 'clip.mp4');
  const framePath = path.join(workDir, 'frame.png');
  try {
    fs.writeFileSync(videoPath, Buffer.from(video.data, 'base64'));
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        // One frame a second in, not frame zero — the very first frame of a
        // fade-in is usually black, which makes a poster look broken.
        .seekInput(POSTER_SEEK_SECONDS)
        .frames(1)
        .output(framePath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const jpeg = await sharp(fs.readFileSync(framePath))
      .resize({ width: POSTER_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: POSTER_QUALITY, mozjpeg: true })
      .toBuffer();

    const poster = {
      id: posterId,
      mimeType: 'image/jpeg',
      data: jpeg.toString('base64'),
      createdAt: new Date().toISOString(),
    };
    await db.put('media', poster);
    return poster;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

module.exports = { compressAndStore, compressVideoAndStore, getMedia, getVideoPoster };
