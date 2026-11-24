// zod/mini rather than classic zod: these schemas are bundled into the web app, where classic
// zod 4 costs ~450 kB minified (its methods can't be tree-shaken) against ~13 kB for mini. Same
// validation engine; checks are passed to .check() instead of chained.
import * as z from "zod/mini";

export const usernameSchema = z
  .string()
  .check(
    z.minLength(3, "Username must be at least 3 characters"),
    z.maxLength(20, "Username must be at most 20 characters"),
    z.regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  );

// 72-byte upper bound matches argon2/bcrypt-safe input limits.
export const passwordSchema = z
  .string()
  .check(
    z.minLength(8, "Password must be at least 8 characters"),
    z.maxLength(72, "Password must be at most 72 characters"),
  );

/** Trimmed and lowercased first, then validated as an email (a pipe, so the format check sees the
 * normalised value). */
const emailSchema = z.pipe(
  z.string().check(z.trim(), z.toLowerCase()),
  z.email("Enter a valid email address").check(z.maxLength(254)),
);

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  displayName: z
    .string()
    .check(z.trim(), z.minLength(1, "Display name is required"), z.maxLength(40)),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  emailOrUsername: z.string().check(z.trim(), z.minLength(1), z.maxLength(254)),
  password: z.string().check(z.minLength(1), z.maxLength(72)),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetConfirmSchema = z.object({
  token: z.string().check(z.minLength(1)),
  newPassword: passwordSchema,
});
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().check(z.minLength(1), z.maxLength(72)),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
