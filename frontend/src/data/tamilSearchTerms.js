/**
 * What our customers actually call these things.
 *
 * Nobody in Udumalpet searches "cold-pressed sesame oil". They search
 * நல்லெண்ணெய், or type "nallennai", or "chekku ennai" — and until now none of
 * those words appeared anywhere on the page, so none of those searches could
 * match it. Meanwhile the English phrase we do use puts us up against Amazon
 * and every national brand, which a shop this size does not win.
 *
 * So this is not keyword padding: it is the same product under the name the
 * person looking for it uses. Each entry is rendered on the product page as a
 * visible "also called" line — useful to a shopper who knows the Tamil name
 * and not the English one — and emitted as schema.org alternateName, which is
 * the field that exists precisely for "this thing has other names".
 *
 * Terms are only listed where they are genuinely that product. Where a
 * traditional name is uncertain, the entry is left out rather than guessed at;
 * an invented Tamil name would be worse than none.
 */

/** Every wood-pressed oil shares these — the words for the pressing method
 * rather than the seed, and the phrase most local searches actually start
 * with. */
const CHEKKU = ['chekku ennai', 'marachekku ennai', 'wood pressed oil', 'ghani oil'];

export const TAMIL_TERMS = {
  // ── Oils ────────────────────────────────────────────────────────────────
  'sesame-oil-1l': {
    tamil: 'நல்லெண்ணெய்',
    also: ['nallennai', 'ellennai', 'chekku nallennai', 'gingelly oil', 'til oil', ...CHEKKU],
  },
  'groundnut-oil-1l': {
    tamil: 'கடலை எண்ணெய்',
    also: ['kadalai ennai', 'verkadalai ennai', 'peanut oil', ...CHEKKU],
  },
  'coconut-oil-1l': {
    tamil: 'தேங்காய் எண்ணெய்',
    also: ['thengai ennai', 'kobbari ennai', 'virgin coconut oil', ...CHEKKU],
  },
  'castor-oil-1l': {
    tamil: 'விளக்கெண்ணெய்',
    also: ['vilakkennai', 'aamanakku ennai', 'arandi oil', ...CHEKKU],
  },

  // ── Soaps ───────────────────────────────────────────────────────────────
  'neem-tulsi-soap': {
    tamil: 'வேம்பு துளசி சோப்பு',
    also: ['vembu thulasi soap', 'veppilai soap', 'neem soap', 'herbal bath soap'],
  },
  'turmeric-sandal-soap': {
    tamil: 'மஞ்சள் சந்தனம் சோப்பு',
    also: ['manjal chandanam soap', 'manjal soap', 'sandalwood soap'],
  },

  // ── Powders ─────────────────────────────────────────────────────────────
  'moringa-leaf-powder': {
    tamil: 'முருங்கை இலை பொடி',
    also: ['murungai ilai podi', 'murungai keerai podi', 'drumstick leaf powder'],
  },
  'amla-powder': {
    tamil: 'நெல்லிக்காய் பொடி',
    also: ['nellikkai podi', 'nelli podi', 'indian gooseberry powder'],
  },

  // ── Spices and masalas ──────────────────────────────────────────────────
  'sambar-masala': {
    tamil: 'சாம்பார் பொடி',
    also: ['sambar podi', 'sambar powder', 'kuzhambu podi'],
  },
  'chicken-masala': {
    tamil: 'சிக்கன் மசாலா',
    also: ['chicken masala podi', 'kozhi masala'],
  },
  'idli-podi': {
    tamil: 'இட்லி மிளகாய் பொடி',
    also: ['idli podi', 'milagai podi', 'chutney podi', 'gunpowder podi'],
  },
  'turmeric-powder': {
    tamil: 'மஞ்சள் தூள்',
    also: ['manjal podi', 'manjal thool', 'haldi powder'],
  },
  'coriander-powder': {
    tamil: 'கொத்தமல்லி தூள்',
    also: ['kothamalli podi', 'malli podi', 'dhania powder'],
  },
  'red-chilli-powder': {
    tamil: 'மிளகாய் தூள்',
    also: ['milagai podi', 'milagai thool', 'chilli powder'],
  },

  // ── Honey ───────────────────────────────────────────────────────────────
  'wild-forest-honey': {
    tamil: 'காட்டுத் தேன்',
    also: ['kaattu then', 'kadu then', 'forest honey', 'raw honey'],
  },
  'ajwain-honey': {
    tamil: 'ஓமம் தேன்',
    also: ['omam then', 'ajwain honey', 'omam honey'],
  },
  'multifloral-honey': {
    tamil: 'இயற்கை தேன்',
    also: ['iyarkai then', 'natural honey', 'raw honey'],
  },

  // ── Sweeteners ──────────────────────────────────────────────────────────
  jaggery: {
    tamil: 'வெல்லம்',
    also: ['vellam', 'naattu vellam', 'country sugar'],
  },
  'jaggery-powder': {
    tamil: 'வெல்லப் பொடி',
    also: ['vellam podi', 'naattu sakkarai', 'jaggery powder'],
  },

  // ── Baby care ───────────────────────────────────────────────────────────
  // The single least-contested thing we sell: a traditional product almost
  // nobody lists online, under names people search in transliteration.
  'vengai-paal-pottu-black-bindi-for-babies': {
    tamil: 'வேங்கை பால் பொட்டு / திருஷ்டி பொட்டு',
    also: ['vengai paal pottu', 'thirushti pottu', 'drishti pottu', 'black bindi for babies', 'kan drishti pottu'],
  },

  // ── Soup ────────────────────────────────────────────────────────────────
  'moringa-soup-mix': {
    tamil: 'முருங்கை சூப் பொடி',
    also: ['murungai soup podi', 'murungai keerai soup', 'drumstick soup mix'],
  },
};

/** The visible line and the schema list both come from here, so they can never
 * say different things. Returns null for products with no entry — the combos
 * and the herbal oil, where no single traditional name is the right one. */
export function tamilTermsFor(productId) {
  return TAMIL_TERMS[productId] || null;
}
