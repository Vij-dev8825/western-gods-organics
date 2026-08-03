// Same free-tier Gemini setup as utils/aiAssistant.js — see that file's
// comment for why an alias model name is used instead of a dated one.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: { answer: { type: 'STRING' } },
  required: ['answer'],
};

/**
 * Drafts a suggested answer to a customer's product question — for an admin
 * to review and edit before publishing (see PATCH /admin/product-questions/:id),
 * never posted automatically. Grounded strictly in the product's own listed
 * fields so it can't invent ingredients, certifications, or health claims
 * that aren't already stated — important for a skincare/consumable product.
 */
async function suggestProductAnswer({ product, question }) {
  if (!process.env.GEMINI_API_KEY) {
    const err = new Error("AI answer suggestions aren't configured — set GEMINI_API_KEY to enable it.");
    err.status = 503;
    throw err;
  }

  const prompt = `You are drafting a suggested reply to a customer's question about a product for Western Gods Organics, a small family-run mill in Udumalpet, Tamil Nadu selling traditional cold-pressed oils, handmade soaps, and herbal powders. An admin will review and edit your draft before it's ever shown to the customer, so it's fine to be direct.

Use ONLY the product information given below. Do not invent ingredients, certifications, safety claims, or medical/health benefits that aren't already stated. If the question asks something this information genuinely can't answer (a specific medical condition, drug interaction, or anything not covered below), say so plainly and suggest the customer consult a doctor or contact the team directly — don't guess or pad the answer. Keep it to 2-4 sentences, warm and direct, matching a small family-run business's voice, not a corporate tone. Return ONLY the requested JSON.

Product name: ${product.name}
Category: ${product.category}
Short description: ${product.shortDescription || '(none)'}
Full description: ${product.description || '(none)'}
Ingredients (INCI, if applicable): ${product.inciIngredients || '(not listed)'}
FSSAI license: ${product.fssaiLicense || '(not listed)'}

Customer's question: "${question}"`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Gemini ${res.status}`);
    err.status = 502;
    throw err;
  }
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) {
    const err = new Error('AI answer suggestion service returned an empty response.');
    err.status = 502;
    throw err;
  }

  const parsed = JSON.parse(raw);
  if (!parsed.answer) {
    const err = new Error('Missing answer in Gemini response.');
    err.status = 502;
    throw err;
  }
  return parsed.answer.trim();
}

module.exports = { suggestProductAnswer };
