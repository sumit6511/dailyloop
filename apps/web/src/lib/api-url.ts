/** Where the API is when VITE_API_URL isn't set: the local dev server. */
export const DEFAULT_API_URL = "http://localhost:4000/api";

/**
 * The API's base URL from VITE_API_URL. Shared by the client and the build (vite.config.ts), which
 * allows exactly this origin in the CSP's connect-src.
 *
 * Hosting platforms that wire one service's URL into another's build-time env vars (e.g.
 * Render's `fromService: { property: host }`) typically hand over a bare hostname — default it
 * to an https origin plus the API's `/api` prefix so it works whether given as `example.com` or
 * a full `https://example.com/api` URL.
 */
export function resolveApiUrl(raw: string | undefined): string {
  const value = raw?.trim() || DEFAULT_API_URL;
  if (/^https?:\/\//.test(value)) return value;
  return `https://${value}/api`;
}
