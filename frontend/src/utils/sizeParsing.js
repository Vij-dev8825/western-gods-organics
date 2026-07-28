/** Parses a size label like "500 ml", "1 L", "100 g", "1 kg" into a
 * normalized { quantity, unit } pair (unit always 'ml' or 'g'), or null if
 * the label doesn't match a recognizable volume/weight pattern (e.g. "Combo Pack"). */
export function parseSizeLabel(label) {
  if (!label) return null;
  const match = String(label).trim().match(/^([\d.]+)\s*(ml|l|g|kg)\b/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'l') return { quantity: value * 1000, unit: 'ml' };
  if (unit === 'kg') return { quantity: value * 1000, unit: 'g' };
  return { quantity: value, unit };
}

/** ₹ price per 100ml/100g for a given price + size label, or null if the
 * label isn't a recognizable volume/weight (e.g. combo packs, bars sold by count). */
export function pricePer100(price, label) {
  const parsed = parseSizeLabel(label);
  if (!parsed || !parsed.quantity) return null;
  return (price / parsed.quantity) * 100;
}
