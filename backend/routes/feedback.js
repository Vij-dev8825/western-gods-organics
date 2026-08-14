/**
 * The one-tap "how did we go" form, opened straight from a WhatsApp message.
 *
 * Deliberately public and unauthenticated: it is answered on a phone, a day
 * after a parcel arrived, by someone who has very likely never made an account
 * — a login wall here would collect nothing from the people most worth hearing
 * from. The token in the URL is the credential: 24 random bytes, minted per
 * order, and the only thing it grants is the right to comment on that one order.
 */
const express = require('express');
const db = require('../data/db');
const {
  ISSUES,
  findOrderByToken,
  getFeedbackForOrder,
  saveFeedback,
} = require('../utils/orderFeedback');
const { getInvoiceSettings } = require('../utils/invoiceSettings');

const router = express.Router();

/** What the form shows. Only ever the order's own summary — never the address,
 *  never the customer's other orders. Anyone holding the link already knows
 *  what they bought; nothing here should tell them anything more. */
router.get('/:token', async (req, res, next) => {
  try {
    const order = await findOrderByToken(req.params.token);
    if (!order) return res.status(404).json({ success: false, message: 'This feedback link is no longer valid.' });

    const settings = await getInvoiceSettings();
    const existing = await getFeedbackForOrder(order.id);
    res.json({
      success: true,
      businessName: settings.businessName,
      order: {
        orderNumber: order.orderNumber,
        deliveredAt: order.deliveredAt || null,
        items: (order.items || []).map((i) => ({ name: i.name, size: i.size, quantity: i.quantity, productId: i.productId })),
      },
      issues: ISSUES,
      // Sent back so a returning customer sees what they already said rather
      // than a blank form that looks like it lost their answer.
      existing: existing ? { rating: existing.rating, issues: existing.issues, comment: existing.comment } : null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:token', async (req, res, next) => {
  try {
    const order = await findOrderByToken(req.params.token);
    if (!order) return res.status(404).json({ success: false, message: 'This feedback link is no longer valid.' });

    const { rating, issues, comment } = req.body || {};
    const result = await saveFeedback(order, { rating, issues, comment });
    if (result.error) return res.status(400).json({ success: false, message: result.error });

    // The public review invitation goes to everyone, whatever they just said.
    // Sending it only to the happy ones would be review-gating; see
    // utils/orderFeedback.js.
    const reviewable = (order.items || []).find((i) => i.productId) || null;
    res.json({
      success: true,
      feedback: result.feedback,
      reviewProductId: reviewable?.productId || null,
      reviewProductName: reviewable?.name || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
