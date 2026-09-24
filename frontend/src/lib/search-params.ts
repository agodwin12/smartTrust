export type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a query param (Next passes repeated keys as arrays). */
export const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

export const toPage = (value: string | string[] | undefined): number => Math.max(1, parseInt(first(value) ?? "1", 10) || 1);

/** Only the listing-related params, as plain strings, for filters + pagination links. */
export function listingParams(sp: SearchParams) {
  return {
    sort: first(sp.sort),
    condition: first(sp.condition),
    minPrice: first(sp.minPrice),
    maxPrice: first(sp.maxPrice),
    location: first(sp.location),
    q: first(sp.q),
  };
}
