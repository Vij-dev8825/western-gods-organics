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
