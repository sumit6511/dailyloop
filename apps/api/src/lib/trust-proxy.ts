/** Matches Fastify's TrustProxyFunction: is the proxy at this hop (0 = the socket peer) trusted? */
export type TrustProxyFn = (address: string, hop: number) => boolean;

/**
 * Fastify `trustProxy` from the TRUST_PROXY env var. A number is how many proxies sit in front of
 * the API: the client IP is then read that many hops from the right of X-Forwarded-For, so entries
 * a client prepends itself are ignored. `true` trusts the whole header, which lets any client
 * pick its own IP (and so dodge per-IP rate limits) — only correct if every hop strips it.
 * Defaults to 1, the common single-load-balancer setup.
 *
 * A hop count is returned as the equivalent trust function (trust the first N hops), which is
 * what Fastify compiles a number into anyway, but is what its type definitions accept.
 */
export function parseTrustProxy(value: string | undefined): boolean | TrustProxyFn {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  if (v !== "" && !/^\d+$/.test(v)) {
    throw new Error(`TRUST_PROXY must be "true", "false" or a number of proxy hops, got "${value}"`);
  }
  const hops = v === "" ? 1 : Number(v);
  if (hops === 0) return false;
  return (_address, hop) => hop < hops;
}
