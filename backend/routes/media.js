const express = require('express');
const { getMedia, getVideoPoster } = require('../utils/mediaStore');

const router = express.Router();

// GET /api/media/:id/poster — a still frame from a stored video, so a hero
// slot can show something immediately instead of a blank rectangle while
// megabytes of clip buffer. Generated on the first request and cached in the
// database from then on. Declared before /:id so the suffix isn't swallowed
// as part of the id.
router.get('/:id/poster', async (req, res, next) => {
  try {
    const poster = await getVideoPoster(req.params.id);
    if (!poster) return res.status(404).json({ success: false, message: 'Media not found.' });
    res.set('Content-Type', poster.mimeType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(poster.data, 'base64'));
  } catch (err) {
    next(err);
  }
});

// GET /api/media/:id — serves a compressed image/video stored in the
// database. Public and long-cached: the id is content-addressed (one id per
// upload, never mutated), so it's always safe to cache indefinitely.
// Supports HTTP Range requests, which video playback (especially iOS Safari)
// relies on for smooth playback and seeking.
router.get('/:id', async (req, res, next) => {
  try {
    const media = await getMedia(req.params.id);
    if (!media) return res.status(404).json({ success: false, message: 'Media not found.' });

    const buffer = Buffer.from(media.data, 'base64');
    res.set('Content-Type', media.mimeType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Accept-Ranges', 'bytes');

    const range = req.headers.range;
    if (!range) {
      res.set('Content-Length', buffer.length);
      return res.send(buffer);
    }

    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : buffer.length - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= buffer.length) {
      res.status(416).set('Content-Range', `bytes */${buffer.length}`);
      return res.end();
    }

    res.status(206);
    res.set('Content-Range', `bytes ${start}-${end}/${buffer.length}`);
    res.set('Content-Length', end - start + 1);
    res.send(buffer.subarray(start, end + 1));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
