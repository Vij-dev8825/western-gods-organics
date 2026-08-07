import { useEffect, useRef, useState } from 'react';

/** Shared scroll-reveal primitive: attach `ref` to the element to observe;
 * `visible` flips true (once, permanently) the first time it scrolls near
 * the viewport, or immediately under prefers-reduced-motion. Used by the
 * <Reveal> wrapper for content that can afford an extra wrapper element,
 * and directly by ProductCard, which can't — it's also the CSS grid item,
 * and wrapping it in another element would break the grid's row-stretch
 * sizing (cards in the same row would stop matching height). */
export function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return undefined;
    }
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}
