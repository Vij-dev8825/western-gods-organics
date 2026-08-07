/** Placeholder shaped like a real ProductCard — same class names
 * (.product-card, .product-media, .product-body) so it drops into the exact
 * same `.grid`/`.grid-compact` container and never causes a layout shift
 * when the real cards swap in. Rendered instead of the old full-page
 * ChakkiWheel spinner while a product list is fetching: research on
 * perceived performance consistently finds a layout-matching skeleton reads
 * as faster than a spinner even at identical load time, and it doesn't hide
 * the page chrome the way a centered spinner does.
 *
 * `count` lets a caller roughly match how many real cards are about to
 * appear, so the page doesn't visibly grow or shrink once data arrives. */
function Bar({ width, height = 14, style }) {
  return <div className="skeleton-bar" style={{ width, height, ...style }} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="product-card skeleton-card" aria-hidden="true">
      <div className="product-media skeleton" />
      <div className="product-body">
        <Bar width="72%" height={17} />
        <Bar width="94%" style={{ marginTop: 8 }} />
        <Bar width="40%" height={12} style={{ marginTop: 10 }} />
        <div className="skeleton-bar" style={{ width: '100%', height: 38, marginTop: 12, borderRadius: 8 }} />
        <Bar width="55%" height={22} style={{ marginTop: 12 }} />
      </div>
    </div>
  );
}

export default function ProductGridSkeleton({ count = 8, dense = false }) {
  return (
    <div className={`grid ${dense ? 'grid-compact' : ''}`}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
