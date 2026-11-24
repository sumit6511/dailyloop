import { randomBytes, createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import {
  registerSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  SESSION_COOKIE_NAME,
  RESERVED_USERNAMES,
} from "@dailyloop/shared";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPasswordForUser } from "../lib/password.js";
import { createSession, destroySessionByToken } from "../lib/session.js";
import { Errors } from "../lib/errors.js";
import { env, webAppUrl } from "../config/env.js";
import { toMeDTO } from "../lib/dto.js";

const isProduction = env.NODE_ENV === "production";
const sessionCookieOptions = {
  httpOnly: true,
  // The web app and API are deployed as separate hosts (different subdomains), which browsers
  // treat as cross-site — a `Lax` cookie would never be sent back on API fetches from the web
  // app. `None` (requires `Secure`, i.e. HTTPS) is the correct policy for this split-service
  // topology. Locally both run on `localhost` (same-site regardless of port), so `Lax` still works.
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  secure: isProduction,
  path: "/",
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/register",
    { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const body = registerSchema.parse(request.body);

      if (RESERVED_USERNAMES.includes(body.username.toLowerCase())) {
        throw Errors.conflict("That username is reserved");
      }

      const existing = await prisma.user.findFirst({
        where: { OR: [{ email: body.email }, { username: body.username }] },
        select: { email: true, username: true },
      });
      if (existing) {
        throw Errors.conflict(
          existing.email === body.email
            ? "Email is already registered"
            : "Username is already taken",
        );
      }

      const passwordHash = await hashPassword(body.password);
      const user = await prisma
        .$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              email: body.email,
              username: body.username,
              passwordHash,
              displayName: body.displayName,
            },
          });
          await tx.streak.create({ data: { userId: created.id } });
          return created;
        })
        .catch((err: unknown) => {
          // Lost a race with a simultaneous registration that passed the same check above.
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const target = String((err.meta as { target?: unknown } | undefined)?.target ?? "");
            throw Errors.conflict(
              target.includes("email")
                ? "Email is already registered"
                : "Username is already taken",
            );
          }
          throw err;
        });

      const { token, expiresAt } = await createSession(user.id, {
        userAgent: request.headers["user-agent"],
        ip: request.ip,
      });
      reply.setCookie(SESSION_COOKIE_NAME, token, { ...sessionCookieOptions, expires: expiresAt });
      return reply.status(201).send({ data: toMeDTO(user) });
    },
  );

  app.post(
    "/login",
    { config: { rateLimit: { max: 20, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);
      // Emails are stored lowercased (registerSchema); usernames are citext, so both halves of
      // this lookup are case-insensitive.
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: body.emailOrUsername.toLowerCase() }, { username: body.emailOrUsername }],
        },
      });
      // Deliberately generic message — don't reveal whether the account exists.
      // Runs Argon2 even for an unknown user so timing doesn't reveal whether the account exists.
      if (!(await verifyPasswordForUser(user?.passwordHash, body.password)) || !user) {
        throw Errors.badRequest("Invalid email/username or password");
      }
      const { token, expiresAt } = await createSession(user.id, {
        userAgent: request.headers["user-agent"],
        ip: request.ip,
      });
      reply.setCookie(SESSION_COOKIE_NAME, token, { ...sessionCookieOptions, expires: expiresAt });
      return reply.send({ data: toMeDTO(user) });
    },
  );

  app.post("/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (token) await destroySessionByToken(token);
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return reply.send({ data: { ok: true } });
  });

  app.get("/me", { preHandler: app.requireAuth }, async (request, reply) => {
    return reply.send({ data: toMeDTO(request.currentUser!) });
  });

  app.post(
    "/password-reset/request",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const body = passwordResetRequestSchema.parse(request.body);
      const user = await prisma.user.findUnique({ where: { email: body.email } });

      // Always respond 200 whether or not the account exists, so this endpoint
      // can't be used to enumerate registered emails.
      if (user) {
        const token = randomBytes(32).toString("hex");
        const tokenHash = createHash("sha256").update(token).digest("hex");
        // Only the newest link works: requesting another revokes any earlier, unused ones.
        await prisma.$transaction([
          prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
          prisma.passwordResetToken.create({
            data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
          }),
        ]);
        const resetLink = `${webAppUrl}/reset-password?token=${token}`;
        // No email provider is wired up yet. In development the link is logged as a stand-in for
        // sending it; in production a live reset link must never reach the logs.
        if (isProduction) {
          request.log.warn(
            { userId: user.id },
            "Password reset requested but no email delivery is configured",
          );
        } else {
          request.log.info(
            { email: user.email, resetLink },
            "Password reset requested (dev: link logged, not emailed)",
          );
        }
      }

      return reply.send({ data: { ok: true } });
    },
  );

  app.post(
    "/password-reset/confirm",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const body = passwordResetConfirmSchema.parse(request.body);
      const tokenHash = createHash("sha256").update(body.token).digest("hex");
      const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

      if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
        throw Errors.badRequest("This reset link is invalid or has expired");
      }

      const passwordHash = await hashPassword(body.newPassword);
      await prisma.$transaction([
        prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
        // Consumes this link and any other outstanding ones.
        prisma.passwordResetToken.deleteMany({ where: { userId: resetToken.userId } }),
        prisma.session.deleteMany({ where: { userId: resetToken.userId } }),
      ]);

      return reply.send({ data: { ok: true } });
    },
  );
};
