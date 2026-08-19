const express = require('express');
const { recordClientError } = require('../utils/clientErrors');

const router = express.Router();

/**
 * POST /api/client-errors — a browser reporting that something threw.
 *
 * Public and unauthenticated by necessity: the errors most worth knowing about
 * are the ones that happen before or instead of a customer logging in. The
 * abuse surface is handled in the util — per-IP throttle, a cap on distinct
 * faults per hour, and hard limits on every stored string.
 *
 * Always answers 204, even when it declined to store. A browser reporting a
 * crash should never receive an error in reply and start a loop, and there is
 * nothing useful it could do with the difference anyway.
 */
router.post('/', async (req, res) => {
  try {
    await recordClientError(req.body, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  } catch (err) {
    // Swallowed on purpose. This endpoint existing must never itself become a
    // source of noise, and there is no caller waiting on the outcome.
    console.error('[client-errors] could not record:', err.message);
  }
  res.status(204).end();
});

module.exports = router;
