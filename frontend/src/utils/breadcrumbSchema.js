import { CANONICAL_ORIGIN } from './site';

// schema.org BreadcrumbList, so Google can show the breadcrumb trail (e.g.
// "westerngodsorganic.com > Shop > Coconut Oil") directly in search results
// instead of the raw URL. `items` should mirror the page's own visual
// breadcrumb exactly — search engines flag breadcrumbs that don't match
// what a visitor actually sees.
export function buildBreadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${CANONICAL_ORIGIN}${item.path}`,
    })),
  };
}
