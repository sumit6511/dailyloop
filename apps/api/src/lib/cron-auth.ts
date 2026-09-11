/**
 * Factored out standalone (rather than inlined in the route) so it's unit-testable without
 * touching the env-singleton or spinning up Fastify — a scheduled external caller (GitHub
 * Actions) can't hold a session cookie, so this checks a shared secret instead.
 */
export function isAuthorizedCronRequest(authHeader: string | undefined, secret: string | undefined): boolean {
  if (!secret) return false;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return token === secret;
}
