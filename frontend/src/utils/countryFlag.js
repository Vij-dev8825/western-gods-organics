// Converts a 2-letter ISO country code into its flag emoji via Unicode
// regional indicator symbols (U+1F1E6 = 'A' ... U+1F1FF = 'Z') — works for
// any real country code, including ones an admin adds later through
// AdminCountries.jsx, with no lookup table to keep in sync.
export function countryFlagEmoji(code) {
  if (!code || code.length !== 2) return '';
  const points = [...code.toUpperCase()].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...points);
}
