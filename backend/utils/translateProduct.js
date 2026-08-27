// Free-tier Gemini. An alias model name rather than a dated one, because a
// dated name stops working for new API keys the moment Google deprecates it —
// which has already happened here once, with gemini-2.5-flash.
//
// This is an ADMIN convenience feature: if the key is missing or the call
// fails, the admin simply writes the text themselves. The customer-facing chat
// assistant deliberately does not depend on Gemini any more — it answers from
// the shop's own data in utils/shopBrain.js — so a Gemini outage never reaches
// a shopper. Admin > Chat Assistant reports what Google is actually saying.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

const LANG_FIELD = {
  type: 'OBJECT',
  properties: { short: { type: 'STRING' }, full: { type: 'STRING' } },
  required: ['short', 'full'],
};

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: { hi: LANG_FIELD, ta: LANG_FIELD, te: LANG_FIELD, kn: LANG_FIELD },
  required: ['hi', 'ta', 'te', 'kn'],
};

/**
 * Translates a product's short/full description into Hindi, Tamil, Telugu
 * and Kannada.
 *
 * Names are deliberately left alone, even though products can now carry a
 * per-language name. A machine asked for the Tamil of "Cold-Pressed Sesame
 * Oil" returns a literal rendering; what a Tamil shopper says and searches
 * for is நல்லெண்ணெய், which no translation of the English will produce. That
 * name is local knowledge and is typed by hand in Admin → Products. `name` is
 * passed here only as context for a more accurate description.
 */
async function translateProductText({ name, shortDescription, description }) {
  if (!process.env.GEMINI_API_KEY) {
    const err = new Error("AI translation isn't configured — set GEMINI_API_KEY to enable it.");
    err.status = 503;
    throw err;
  }

  const prompt = `Translate this e-commerce product copy for an Indian D2C natural-products store ("Western Gods Organics") into Hindi, Tamil, Telugu, and Kannada. Keep the warm, traditional tone of the English original. Do not translate the product name itself, brand names, or numbers/units. Write natural, fluent copy a native speaker would use in a real product listing, not a literal word-for-word translation. Return ONLY the requested JSON.

Product name (context only, do not translate): ${name}
Short description (English): ${shortDescription || '(none)'}
Full description (English): ${description || '(none)'}`;

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
    const err = new Error('Translation service returned an empty response.');
    err.status = 502;
    throw err;
  }

  const parsed = JSON.parse(raw);
  const shortDescriptions = {};
  const descriptions = {};
  for (const code of ['hi', 'ta', 'te', 'kn']) {
    if (parsed[code]?.short) shortDescriptions[code] = parsed[code].short.trim();
    if (parsed[code]?.full) descriptions[code] = parsed[code].full.trim();
  }
  return { shortDescriptions, descriptions };
}

module.exports = { translateProductText };
