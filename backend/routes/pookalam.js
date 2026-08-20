/**
 * Public endpoints for the Onam pookalam contest.
 *
 * Admin-side moderation and prize-giving live in routes/admin.js, which is
 * globally gated by requireAdmin — putting them here would mean re-doing that
 * gate and stepping outside the audit log every admin mutation goes through.
 */
const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { imageUpload, storeUploadedFile } = require('../utils/imageUploadHandler');
const pookalam = require('../utils/pookalam');

const router = express.Router();

/**
 * GET /api/pookalam/gallery — approved entries, winner first.
 *
 * Public and unauthenticated. Returns nothing until the admin approves
 * something, which is the whole point of the moderation step: an unreviewed
 * submission never appears on the storefront.
 */
router.get('/gallery', async (req, res, next) => {
  try {
    const entries = await pookalam.gallery();
    res.json({ success: true, entries });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/pookalam/entries — submit a pookalam.
 *
 * Multipart, field name `image`, because a 1080x1080 PNG as a base64 JSON body
 * is around 1.4 MB against the app's 2 MB express.json ceiling — too close to
 * the edge to rely on. The shared `imageUpload` multer allows 10 MB and only
 * jpg/png/webp, and `storeUploadedFile` puts it wherever the rest of the app's
 * images go (Cloudinary when configured, otherwise compressed into the media
 * collection) and deletes the temp file.
 *
 * optionalAuth, not requireAuth: guests may enter. A logged-in entrant gets
 * their user id recorded, which is what later lets their prize coupon be
 * locked to them and their win be delivered in-app.
 */
router.post(
  '/entries',
  optionalAuth,
  imageUpload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: 'Attach your pookalam picture to enter.' });
      }

      /* Multer checked the file extension, not the bytes. A renamed or
         truncated file only fails here, inside the image decoder, and that is a
         bad request rather than a server fault — worth saying so, because the
         entrant can fix it and a 500 tells them nothing. */
      let image;
      try {
        image = await storeUploadedFile(req.file);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: 'That file could not be read as an image. Please try again.',
        });
      }

      const entry = await pookalam.createEntry({
        title: req.body.title,
        name: req.body.name,
        phone: req.body.phone,
        score: req.body.score,
        blooms: req.body.blooms,
        image,
        userId: req.user?.id || null,
      });

      /* The claim token goes back exactly once, to the browser that submitted.
         It is how this device proves the entry is its own later on. */
      res.status(201).json({
        success: true,
        message: 'Entry received. We will post it once it has been checked.',
        claimToken: entry.claimToken,
        entry: pookalam.toOwner(entry),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/pookalam/entries/mine — the caller's own entries.
 *
 * Two ways in, matching the two ways to enter:
 *   ?token=<claimToken>  a guest's device presenting its secret
 *   Authorization header  a member, matched on user id
 *
 * Never looks anything up by phone number. A phone lookup would let anyone
 * walk the contest and read other people's prize codes.
 */
router.get('/entries/mine', optionalAuth, async (req, res, next) => {
  try {
    const found = [];

    if (req.user?.id) {
      found.push(...(await pookalam.entriesForUser(req.user.id)));
    }

    const token = req.query.token;
    if (token) {
      const byToken = await pookalam.entryByClaimToken(String(token));
      if (byToken && !found.some((e) => e.id === byToken.id)) found.push(byToken);
    }

    res.json({ success: true, entries: found.map(pookalam.toOwner) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
