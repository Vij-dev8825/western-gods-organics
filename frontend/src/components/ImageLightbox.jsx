import { useEffect } from 'react';
import { getProductImage } from '../utils/productImages';

/** Full-screen zoom viewer for a product's photo gallery, with prev/next
 * arrows and a thumbnail strip — opened by tapping the main product image. */
export default function ImageLightbox({ images, index, onIndexChange, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndexChange((index + 1) % images.length);
      if (e.key === 'ArrowLeft') onIndexChange((index - 1 + images.length) % images.length);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, images.length, onIndexChange, onClose]);

  return (
    <div className="lightbox-overlay" role="dialog" aria-modal="true" aria-label="Product image viewer" onClick={onClose}>
      <button className="lightbox-close" aria-label="Close" onClick={onClose}>×</button>

      {images.length > 1 && (
        <button
          className="lightbox-arrow lightbox-arrow-prev"
          aria-label="Previous photo"
          onClick={(e) => { e.stopPropagation(); onIndexChange((index - 1 + images.length) % images.length); }}
        >
          ‹
        </button>
      )}

      <img
        src={getProductImage(images[index])}
        alt=""
        className="lightbox-image"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <button
          className="lightbox-arrow lightbox-arrow-next"
          aria-label="Next photo"
          onClick={(e) => { e.stopPropagation(); onIndexChange((index + 1) % images.length); }}
        >
          ›
        </button>
      )}

      {images.length > 1 && (
        <div className="lightbox-thumbs" onClick={(e) => e.stopPropagation()}>
          {images.map((img, i) => (
            <button
              key={i}
              className={`lightbox-thumb ${i === index ? 'active' : ''}`}
              aria-label={`Show photo ${i + 1}`}
              onClick={() => onIndexChange(i)}
            >
              <img src={getProductImage(img)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
