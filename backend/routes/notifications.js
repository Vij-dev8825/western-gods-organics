const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { requireAuth } = require('../middleware/auth');
const push = require('../utils/push');

const router = express.Router();

// GET /api/notifications/push-key — public VAPID public key for the
// frontend to subscribe with. { key: null } when push isn't configured.
router.get('/push-key', (req, res) => {
  res.json({ success: true, key: push.isConfigured() ? process.env.VAPID_PUBLIC_KEY : null });
});

// POST /api/notifications/push-subscribe  { subscription }
router.post('/push-subscribe', requireAuth, async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) {
      return res.status(400).json({ success: false, message: 'A valid push subscription is required.' });
    }
    const existing = (await db.list('push-subscriptions')).find(
      (s) => s.userId === req.user.id && s.subscription.endpoint === subscription.endpoint
    );
    if (existing) return res.json({ success: true });

    await db.put('push-subscriptions', {
      id: uuid(),
      userId: req.user.id,
      subscription,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/push-unsubscribe  { endpoint }
router.post('/push-unsubscribe', requireAuth, async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    const mine = (await db.list('push-subscriptions')).filter(
      (s) => s.userId === req.user.id && (!endpoint || s.subscription.endpoint === endpoint)
    );
    for (const s of mine) await db.remove('push-subscriptions', s.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/notifications — my notifications, newest first
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const notifications = (await db.list('notifications'))
      .filter((n) => n.userId === req.user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
    const unread = notifications.filter((n) => !n.read).length;
    res.json({ success: true, unread, notifications });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all
router.post('/read-all', requireAuth, async (req, res, next) => {
  try {
    const mine = (await db.list('notifications')).filter(
      (n) => n.userId === req.user.id && !n.read
    );
    for (const n of mine) {
      n.read = true;
      await db.put('notifications', n);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const n = await db.get('notifications', req.params.id);
    if (!n || n.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    n.read = true;
    await db.put('notifications', n);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
