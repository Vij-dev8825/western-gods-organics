/** The price a specific customer actually pays for a size — the wholesale
 * rate for a flagged account (see Admin → Enquiries & Leads → Customers)
 * when the admin has set one, otherwise the regular retail price. Mirrors
 * the same fallback backend/utils/orderBuilder.js enforces server-side, so
 * what's shown while browsing always matches what checkout actually charges. */
export function getEffectivePrice(sizeInfo, isWholesale) {
  if (isWholesale && sizeInfo?.wholesalePrice > 0) return sizeInfo.wholesalePrice;
  return sizeInfo?.price ?? 0;
}

export function isWholesalePriceApplied(sizeInfo, isWholesale) {
  return !!(isWholesale && sizeInfo?.wholesalePrice > 0);
}
