const express = require('express');
const { getMedia } = require('../utils/mediaStore');

const router = express.Router();

// GET /api/media/:id — serves a compressed image stored in the database.
// Public and long-cached: the id is content-addressed (one id per upload,
// never mutated), so it's always safe to cache indefinitely.
router.get('/:id', async (req, res, next) => {
  try {
    const media = await getMedia(req.params.id);
    if (!media) return res.status(404).json({ success: false, message: 'Image not found.' });
    res.set('Content-Type', media.mimeType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(media.data, 'base64'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
