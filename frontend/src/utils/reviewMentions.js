const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'was', 'this', 'that', 'have', 'has', 'not', 'but', 'are',
  'you', 'your', 'from', 'very', 'good', 'nice', 'great', 'product', 'use', 'used', 'after',
  'all', 'just', 'also', 'get', 'got', 'its', 'my', 'our', 'out', 'been', 'were', 'when',
  'than', 'then', 'they', 'them', 'will', 'would', 'could', 'about', 'really',
]);

/**
 * Top few words mentioned by at least two different reviewers, excluding the
 * product's own name so a word like "castor" or "oil" doesn't win every time.
 * Counts each word once per review (not per occurrence) so one gushing
 * review can't dominate the tally alone. Returns null rather than guessing
 * when there isn't enough real review text to say anything honest — mirrors
 * the same rule backend/utils/shopBrain.js applies for the chat assistant's
 * equivalent answer, kept separate here since the two run in different
 * runtimes with the reviews already in hand on this side.
 */
export function summarizeMentions(reviews, productName, { minReviews = 3 } = {}) {
  const nameWords = new Set(
    String(productName || '')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(Boolean)
  );
  const withText = (reviews || []).filter((r) => r.text && r.text.trim().length > 10);
  if (withText.length < minReviews) return null;

  const freq = new Map();
  for (const r of withText) {
    const words = r.text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
    const seenInThisReview = new Set();
    for (const w of words) {
      if (w.length < 4 || STOPWORDS.has(w) || nameWords.has(w) || seenInThisReview.has(w)) continue;
      seenInThisReview.add(w);
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  const top = [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w);
  return top.length ? top : null;
}
