import fp from "fastify-plugin";
import { corsOrigins } from "../config/env.js";
import { Errors } from "../lib/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Lightweight CSRF defense: our session cookie is SameSite=Lax, which already
 * blocks it being attached to cross-site POST/PUT/PATCH/DELETE form submissions.
 * This adds a belt-and-braces check for the remaining case (some older browsers,
 * subdomain-based attacks) by rejecting mutating requests whose Origin header
 * isn't one of our known frontends. Non-browser callers that omit Origin
 * (curl, server-to-server, same-origin fetches in some setups) are allowed through
 * since they can't be riding on a victim's browser cookies in the first place.
 */
export default fp(async (app) => {
  app.addHook("onRequest", async (request) => {
    if (SAFE_METHODS.has(request.method)) return;
    const origin = request.headers.origin;
    if (!origin) return;
    if (!corsOrigins.includes(origin)) {
      throw Errors.forbidden("Cross-origin request blocked");
    }
  });
});
