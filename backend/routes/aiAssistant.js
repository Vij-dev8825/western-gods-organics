const express = require('express');
const { askAssistant, streamAssistant } = require('../utils/aiAssistant');
const { optionalAuth } = require('../middleware/auth');
const db = require('../data/db');

const router = express.Router();

// Simple in-memory per-IP daily cap — Google's free Gemini tier is a single
// shared quota (1,500 requests/day) for the whole site, so this protects it
// from being exhausted by one abusive client. Resets naturally on redeploy;
// no persistence needed for a soft anti-abuse limit like this.
const RATE_LIMIT_PER_DAY = 60;
const usage = new Map(); // ip -> { count, day }

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function checkRateLimit(ip) {
  const day = todayKey();
  const entry = usage.get(ip);
  if (!entry || entry.day !== day) {
    usage.set(ip, { count: 1, day });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_DAY) return false;
  entry.count += 1;
  return true;
}

// POST /api/ai-assistant  { message, history?: [{from:'user'|'bot', text}] }
// optionalAuth so a signed-in customer's own order history can inform the
// answer ("what did I order last time", "time to restock?"). Guests get the
// same assistant minus that context — nothing here requires a login.
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { message, history } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Enter a message.' });
    }
    if (message.length > 1000) {
      return res.status(400).json({ success: false, message: 'Message is too long.' });
    }
    if (!checkRateLimit(req.ip)) {
      return res.status(429).json({
        success: false,
        message: 'You\'ve reached today\'s limit for the AI assistant — please try again tomorrow, or use "Chat with us" instead.',
      });
    }

    // Read the account fresh rather than trusting the JWT's claims — the name
    // shown back to the customer and the orders quoted to them should reflect
    // the record as it stands now.
    const user = req.user?.id ? await db.get('users', req.user.id) : null;

    const priorTurns = Array.isArray(history) ? history : [];

    // Streaming when the client asks for it, whole-answer JSON otherwise.
    // Negotiating on Accept rather than adding a second URL means a browser
    // still running an older cached bundle keeps working unchanged.
    if (req.get('accept')?.includes('text/event-stream')) {
      res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // LiteSpeed and other reverse proxies buffer responses by default,
        // which would hold the whole stream back and undo the point of it.
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders?.();

      const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      const result = await streamAssistant(message.trim(), priorTurns, user, (delta) =>
        send('text', { delta })
      );
      send('done', {
        productIds: result.productIds || [],
        suggestions: result.suggestions || [],
      });
      return res.end();
    }

    const result = await askAssistant(message.trim(), priorTurns, user);
    res.json({
      success: true,
      reply: result.reply,
      productIds: result.productIds || [],
      suggestions: result.suggestions || [],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
