const express = require('express');
const shopBrain = require('../utils/shopBrain');
const { askAssistant, streamAssistant } = require('../utils/aiAssistant');

/**
 * Gemini is off unless someone deliberately turns it on.
 *
 * The shop's own assistant answers by default: no key, no quota, no outage, and
 * it never dead-ends. Set USE_GEMINI=1 (with a working GEMINI_API_KEY) to put
 * Gemini in front of it for freer-form conversation — and even then, anything
 * Gemini fails to answer falls through to the local assistant rather than to an
 * apology. Admin > Chat Assistant reports which is actually in use.
 */
const useGemini = () => process.env.USE_GEMINI === '1' && !!process.env.GEMINI_API_KEY;
const { optionalAuth } = require('../middleware/auth');
const db = require('../data/db');

const router = express.Router();

// A soft per-IP daily cap. This used to exist because Google's free Gemini tier
// was one shared 1,500/day quota for the whole site and a single abusive client
// could exhaust it for everyone. The assistant now answers locally, so there is
// no quota left to protect and the only cost is CPU — the cap stays purely as
// anti-abuse, and is set far higher because a genuine shopper asking thirty
// questions is no longer expensive.
const RATE_LIMIT_PER_DAY = 300;
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

      let result = null;

      if (useGemini()) {
        // Gemini streams genuinely, token by token, and its own 20s timeout
        // bounds the wait. If it fails we answer from the shop's data instead
        // of leaving the customer with an apology — but ONLY if it has not
        // already put words on screen. Falling back after a half-delivered
        // answer would append a second one to the first, which is worse than
        // the truncation it was trying to rescue.
        let delivered = 0;
        const streamed = await streamAssistant(message.trim(), priorTurns, user, (delta) => {
          if (delta) delivered += delta.length;
          send('text', { delta });
        });
        if (!streamed?.error || delivered > 0) result = streamed;
      }

      if (!result) {
        // The local answer is ready immediately, so there is nothing to stream
        // in the sense there was with a remote model. It is still delivered in
        // pieces, because the widget's typing effect is driven by these events
        // and one frame carrying the whole reply lands as a wall of text.
        result = await shopBrain.answer(message.trim(), priorTurns, user);
        const parts = String(result.reply).split(/(\s+)/);
        for (let i = 0; i < parts.length; i += 4) {
          send('text', { delta: parts.slice(i, i + 4).join('') });
        }
      }

      send('done', {
        productIds: result.productIds || [],
        suggestions: result.suggestions || [],
      });
      return res.end();
    }

    let result = null;
    if (useGemini()) {
      const asked = await askAssistant(message.trim(), priorTurns, user);
      if (!asked?.error) result = asked;
    }
    if (!result) result = await shopBrain.answer(message.trim(), priorTurns, user);

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
