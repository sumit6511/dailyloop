/**
 * Per-account brake on password guessing, complementing the per-IP rate limit (which a credential
 * stuffer spreads across many IPs). After MAX_FAILURES failed sign-ins for one identifier within
 * WINDOW_MS, further attempts for it are refused until the window ends — even with the right
 * password, or the guessing would simply continue.
 *
 * Keyed on the identifier as typed (lowercased), whether or not such an account exists, so the
 * lockout itself never reveals which accounts are real. A successful sign-in or password reset
 * clears it. In-memory: per API instance, which still bounds guessing to MAX_FAILURES per window
 * per instance.
 */
export const MAX_FAILURES = 10;
export const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED = 50_000;

interface Entry {
  failures: number;
  windowEndsAt: number;
}

export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  private static key(identifier: string): string {
    return identifier.trim().toLowerCase();
  }

  /** Milliseconds until this identifier may try again, or 0 if it isn't locked. */
  retryAfterMs(identifier: string): number {
    const entry = this.entries.get(LoginThrottle.key(identifier));
    if (!entry || entry.windowEndsAt <= this.now()) return 0;
    return entry.failures >= MAX_FAILURES ? entry.windowEndsAt - this.now() : 0;
  }

  recordFailure(identifier: string): void {
    const key = LoginThrottle.key(identifier);
    const now = this.now();
    const entry = this.entries.get(key);
    if (!entry || entry.windowEndsAt <= now) {
      this.entries.delete(key); // re-insert so Map order stays oldest-first
      this.entries.set(key, { failures: 1, windowEndsAt: now + WINDOW_MS });
      this.prune(now);
    } else {
      entry.failures++;
    }
  }

  clear(...identifiers: string[]): void {
    for (const identifier of identifiers) this.entries.delete(LoginThrottle.key(identifier));
  }

  reset(): void {
    this.entries.clear();
  }

  /** Bounds memory under a flood of distinct identifiers: expired entries first, then oldest. */
  private prune(now: number): void {
    if (this.entries.size <= MAX_TRACKED) return;
    for (const [key, entry] of this.entries) {
      if (entry.windowEndsAt <= now) this.entries.delete(key);
    }
    for (const key of this.entries.keys()) {
      if (this.entries.size <= MAX_TRACKED) break;
      this.entries.delete(key);
    }
  }
}

export const loginThrottle = new LoginThrottle();
