import { randomBytes, createHash } from "node:crypto";
import { SESSION_DURATION_DAYS } from "@dailyloop/shared";
import { prisma } from "./prisma.js";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newExpiry(): Date {
  return new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

export async function createSession(userId: string, meta: { userAgent?: string; ip?: string }) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = newExpiry();
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, userAgent: meta.userAgent, ip: meta.ip },
  });
  return { token, expiresAt };
}

/** Returns the session's owner, or null if the token is missing/expired — and
 * transparently slides the expiry forward so active users are never logged out
 * mid-session while idle ones still expire after SESSION_DURATION_DAYS. */
export async function getUserBySessionToken(token: string) {
  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  void prisma.session
    .update({ where: { id: session.id }, data: { lastUsedAt: new Date(), expiresAt: newExpiry() } })
    .catch(() => undefined);
  return session.user;
}

export async function destroySessionByToken(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
