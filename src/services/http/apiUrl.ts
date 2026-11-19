/** Default when `VITE_API_BASE_URL` is not set: same-site API (API.md 2.2, cookie SameSite=Strict). */
const DEFAULT_API_BASE = '/api/v1';
const FALLBACK_ORIGIN = 'http://localhost';

export type QueryValue = string | number | boolean | null | undefined | readonly string[];
export type QueryParams = Readonly<Record<string, QueryValue>>;

/** Absolute base URL of the API, always ending in `/`. Relative bases resolve against the page. */
export function apiBaseUrl(configured: string | undefined = import.meta.env.VITE_API_BASE_URL): string {
  const base = configured && configured.trim() !== '' ? configured.trim() : DEFAULT_API_BASE;
  const origin = typeof location === 'undefined' ? FALLBACK_ORIGIN : location.origin;
  return new URL(base.endsWith('/') ? base : `${base}/`, origin).toString();
}

/**
 * Builds the absolute URL of an API path such as `/patients/me/overview`.
 * The client and the MSW handlers both use it, so they can never drift apart.
 * `null`/`undefined` query values are skipped; arrays repeat the key.
 */
export function apiUrl(path: string, query: QueryParams = {}, base: string = apiBaseUrl()): string {
  const url = new URL(path.replace(/^\//, ''), base);
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value as readonly string[]) url.searchParams.append(key, item);
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}
