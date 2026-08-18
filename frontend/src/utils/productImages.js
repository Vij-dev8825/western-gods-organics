import castorOil from '../assets/products/castor-oil.jpeg';
import coconutOil from '../assets/products/coconut-oil.jpeg';
import sesameOil from '../assets/products/sesame-oil.jpeg';
import groundnutOil from '../assets/products/groundnut-oil.jpeg';
import neemSoap from '../assets/products/neem-soap.svg';
import turmericSoap from '../assets/products/turmeric-soap.svg';
import moringaPowder from '../assets/products/moringa-powder.svg';
import amlaPowder from '../assets/products/amla-powder.svg';

const productImages = {
  'castor-oil.jpeg': castorOil,
  'coconut-oil.jpeg': coconutOil,
  'sesame-oil.jpeg': sesameOil,
  'groundnut-oil.jpeg': groundnutOil,
  'neem-soap.svg': neemSoap,
  'turmeric-soap.svg': turmericSoap,
  'moringa-powder.svg': moringaPowder,
  'amla-powder.svg': amlaPowder,
};

export const knownProductImages = Object.keys(productImages);

export function getProductImage(filename) {
  if (!filename) return castorOil;
  // Admin-uploaded images are served by the backend; bundled assets by name.
  if (filename.startsWith('/uploads/') || filename.startsWith('/api/media/') || filename.startsWith('http')) return filename;
  return productImages[filename] || castorOil;
}

/** Widths the backend will actually produce. Asking for anything else falls
 *  back to the full-size original, so these must stay in step with
 *  VARIANT_WIDTHS in backend/utils/mediaStore.js. */
const SRCSET_WIDTHS = [200, 400, 800, 1200];

/**
 * Builds a srcset for an admin-uploaded photograph so the browser fetches the
 * size it is going to paint.
 *
 * Uploads are stored once at 1600px, which is right for a product-page hero
 * and wrong for everything else: the shop grid renders that same file into a
 * 156px box, twenty-five at a time. Measured on the live site, that is around
 * a megabyte of images to look at a page of thumbnails — on the connections
 * most of these customers are using.
 *
 * Returns null for anything that cannot be resized — bundled assets, external
 * URLs, an empty field. Callers pass that straight to srcset, where null means
 * "just use src", so the caller needs no branch of its own.
 */
export function getProductImageSrcSet(filename) {
  const src = getProductImage(filename);
  if (typeof src !== 'string' || !src.startsWith('/api/media/')) return null;
  const sep = src.includes('?') ? '&' : '?';
  return SRCSET_WIDTHS.map((w) => `${src}${sep}w=${w} ${w}w`).join(', ');
}
