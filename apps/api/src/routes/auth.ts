import { randomBytes, createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import {
  registerSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  SESSION_COOKIE_NAME,
  RESERVED_USERNAMES,
} from "@dailyloop/shared";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { createSession, destroySessionByToken } from "../lib/session.js";
import { Errors } from "../lib/errors.js";
import { env } from "../config/env.js";
import { toMeDTO } from "../lib/dto.js";

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
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
          existing.email === body.email ? "Email is already registered" : "Username is already taken",
        );
      }

      const passwordHash = await hashPassword(body.password);
      const user = await prisma.$transaction(async (tx) => {
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
      const user = await prisma.user.findFirst({
        where: { OR: [{ email: body.emailOrUsername }, { username: body.emailOrUsername }] },
      });
      // Deliberately generic message — don't reveal whether the account exists.
      if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
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
        await prisma.passwordResetToken.create({
          data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
        });
        const resetLink = `${env.WEB_APP_URL}/reset-password?token=${token}`;
        // No email provider is wired up yet — logging is the dev-mode "transport".
        // Swap this for a real EmailSender implementation before shipping to prod.
        request.log.info({ email: user.email, resetLink }, "Password reset requested");
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
        prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
        prisma.session.deleteMany({ where: { userId: resetToken.userId } }),
      ]);

      return reply.send({ data: { ok: true } });
    },
  );
};
