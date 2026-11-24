import { randomBytes } from "node:crypto";
import argon2 from "argon2";

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * Like verifyPassword, but for a user who may not exist: with no hash it still runs a full Argon2
 * verification (against a throwaway hash) before returning false, so a login for an unknown
 * account takes as long as a wrong password — response timing can't reveal which accounts exist.
 */
export async function verifyPasswordForUser(
  hash: string | null | undefined,
  password: string,
): Promise<boolean> {
  if (hash) return verifyPassword(hash, password);
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(await dummyHash, password);
  return false;
}
