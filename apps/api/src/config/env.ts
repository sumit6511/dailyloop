import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),
  WEB_APP_URL: z.string().min(1, "WEB_APP_URL is required"),
  APP_SECRET: z.string().min(16, "APP_SECRET must be at least 16 characters"),
  DEFAULT_TIMEZONE: z.string().min(1).default("Asia/Kathmandu"),
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
