// Products store English text in `description`/`shortDescription` and optional
// translations in `descriptions`/`shortDescriptions` (keyed by language code,
// e.g. { hi: '...', ta: '...' }). English isn't a key in those maps — it's
// always the base field, and every other language falls back to it when a
// translation hasn't been entered yet.
export function localizeProductText(product, field, lang) {
  if (!product) return '';
  if (lang && lang !== 'en') {
    const translated = product[`${field}s`]?.[lang];
    if (translated) return translated;
  }
  return product[field] || '';
}
