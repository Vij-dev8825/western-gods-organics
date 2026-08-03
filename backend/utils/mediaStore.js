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

/** Transcodes a video file to a size-capped, muted-friendly web MP4 (720p
 * max, H.264/no-audio since banner videos always autoplay muted) and stores
 * it the same way as images. Throws if the result is still too large for a
 * database row — the fix there is a shorter/lower-res source clip. */
/** keepAudio: home-page banners are silent decoration so they drop the audio
 * track (smaller file, and autoplay would be muted anyway). A seller's product
 * clip is the opposite — often someone talking through how they make it — so
 * that caller opts back in. */
async function compressVideoAndStore(inputPath, { keepAudio = false } = {}) {
  const outputPath = path.join(os.tmpdir(), `${uuid()}.mp4`);
  await new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath).videoCodec('libx264');
    if (keepAudio) command.audioCodec('aac').audioBitrate('96k');
    else command.noAudio();
    command
      .videoFilters(`scale=-2:'min(${VIDEO_MAX_HEIGHT},ih)'`)
      .videoBitrate(VIDEO_BITRATE)
      .outputOptions(['-preset veryfast', '-movflags +faststart'])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  const buffer = fs.readFileSync(outputPath);
  fs.unlink(outputPath, () => {});

  if (buffer.length > VIDEO_MAX_OUTPUT_BYTES) {
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

module.exports = { compressAndStore, compressVideoAndStore, getMedia };
