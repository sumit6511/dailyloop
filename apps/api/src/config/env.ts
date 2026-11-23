import { z } from "zod";
import { parseTrustProxy } from "../lib/trust-proxy.js";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),
  WEB_APP_URL: z.string().min(1, "WEB_APP_URL is required"),
  APP_SECRET: z.string().min(16, "APP_SECRET must be at least 16 characters"),
  DEFAULT_TIMEZONE: z.string().min(1).default("Asia/Kathmandu"),
  /** Bearer-token secret for the scheduled pre-warm cron endpoint (see routes/cron.ts). Optional
   * — if unset, that endpoint rejects every request rather than accepting an unauthenticated one.
   * An empty value (as shipped in .env.example) counts as unset rather than failing startup. */
  CRON_SECRET: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(16).optional()),
  /** How many proxies sit in front of the API (see lib/trust-proxy.ts). */
  TRUST_PROXY: z
    .string()
    .regex(/^\s*(true|false|\d+)?\s*$/i, 'TRUST_PROXY must be "true", "false" or a number of hops')
    .optional()
    .transform(parseTrustProxy),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:\n", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables — check your .env file against .env.example");
}

export const env = parsed.data;

// Hosting platforms that wire one service's URL into another's env vars (e.g. Render's
// `fromService: { property: host }`) typically hand over a bare hostname, not a full origin —
// default it to https so CORS_ORIGIN/WEB_APP_URL work whether given as `example.com` or
// `https://example.com`.
function withScheme(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

export const corsOrigins = env.CORS_ORIGIN.split(",").map((origin) => withScheme(origin.trim()));
export const webAppUrl = withScheme(env.WEB_APP_URL);
