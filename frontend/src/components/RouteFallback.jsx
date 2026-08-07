import { useEffect } from 'react';
import ChakkiWheel from './ChakkiWheel';
import { startRouteLoad, endRouteLoad } from '../utils/routeProgress';

/** Suspense fallback for a lazy route's chunk still downloading — the gap
 * between "code not yet fetched" and "component ready to render". This is a
 * different moment from a page's own data-loading skeleton (see
 * ProductCardSkeleton): by the time a page is fetching its own data, its
 * code has already loaded and this fallback is long gone.
 *
 * Used as the `fallback` for a small Suspense boundary around each layout's
 * own <Outlet> (StoreLayout, AdminLayout, SellerLayout, SellerPublicLayout),
 * not around the whole app — that split is what keeps the navbar/sidebar on
 * screen during an in-app navigation instead of the entire page (chrome
 * included) blanking out while the next page's chunk downloads. It's also
 * used once more for the top-level Suspense in App.jsx, which only ever
 * catches a layout shell itself loading for the first time.
 *
 * Reports to utils/routeProgress on mount/unmount so the always-mounted
 * TopProgressBar reflects real load state without needing to know this
 * component, or Suspense, exists. */
export default function RouteFallback() {
  useEffect(() => {
    startRouteLoad();
    return () => endRouteLoad();
  }, []);
  return (
    <div className="center" style={{ padding: '120px 0' }}>
      <ChakkiWheel size={56} />
    </div>
  );
}
