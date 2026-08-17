import { useEffect, useRef, useState } from 'react';

/** An <img> that fades in once the bytes have actually arrived, instead of
 *  snapping into place. Everything here is lazily loaded, which is right —
 *  but on a village 4G line the hard jump from empty box to photo reads as a
 *  page still being built. A short fade reads as one that is loading.
 *
 *  The awkward case is a cached image: it can finish decoding before React
 *  has attached onLoad, so that event never fires and the image would sit at
 *  zero opacity for ever. `complete` is checked on mount for exactly that,
 *  and again whenever src changes (the gallery swaps src on the same node).
 *
 *  onError also reveals it — a broken image should show its alt text, not
 *  nothing at all. */
export default function FadeImage({ className = '', src, ...rest }) {
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    // naturalWidth guards against `complete` being true for a src that failed
    // or was never set — complete alone is true in both those cases too.
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true);
  }, [src]);

  return (
    <img
      {...rest}
      ref={ref}
      src={src}
      className={`fade-img${loaded ? ' fade-img-in' : ''}${className ? ` ${className}` : ''}`}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
    />
  );
}
