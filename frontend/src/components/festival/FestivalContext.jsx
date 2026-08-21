/**
 * The current festival, shared with anything on the page that needs it.
 *
 * A context rather than each consumer calling the hook, because the consumers
 * are product cards: a shop page has twenty of them and twenty subscriptions
 * to the same never-changing value is waste, even with the fetch itself
 * cached. The shell already holds this data for the weather layer, so it costs
 * nothing to hand down.
 *
 * Everything here is safe to read before the fetch lands — an empty set and a
 * null festival, which is also the honest state for eleven months of the year.
 */
import { createContext, useContext, useMemo } from 'react';
import { useNearestFestival } from './useFestival';

const FestivalContext = createContext({ festival: null, theme: null, productIds: new Set() });

export function FestivalProvider({ children }) {
  const { festival, theme, animation, flowers } = useNearestFestival();

  const value = useMemo(() => ({
    festival,
    theme,
    animation,
    flowers,
    /* Which products this season actually calls for. The festival record has
       carried this list all along; nothing outside the home page band had ever
       been told about it, so an oil the shop had marked as the one for Onam
       looked exactly like every other oil on the shop page. */
    productIds: new Set((festival?.products || []).map((p) => p.id)),
  }), [festival, theme, animation, flowers]);

  return <FestivalContext.Provider value={value}>{children}</FestivalContext.Provider>;
}

export function useFestivalContext() {
  return useContext(FestivalContext);
}

/** True when this product is one the current festival calls for. */
export function useIsFestivalProduct(productId) {
  const { productIds, theme, festival } = useFestivalContext();
  return {
    isFestival: !!productId && productIds.has(productId),
    theme,
    festival,
  };
}
