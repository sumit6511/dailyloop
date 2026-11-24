import { describe, it, expect } from "vitest";
import { LoginThrottle, MAX_FAILURES, WINDOW_MS } from "./login-throttle.js";

describe("LoginThrottle", () => {
  const make = () => {
    let now = 1_000_000;
    return { throttle: new LoginThrottle(() => now), advance: (ms: number) => (now += ms) };
  };

  it("locks an identifier after MAX_FAILURES failures, case-insensitively", () => {
    const { throttle } = make();
    for (let i = 0; i < MAX_FAILURES - 1; i++) throttle.recordFailure("Harry");
    expect(throttle.retryAfterMs("harry")).toBe(0);
    throttle.recordFailure("HARRY");
    expect(throttle.retryAfterMs("harry")).toBe(WINDOW_MS);
  });

  it("unlocks when the window ends, and counts afresh", () => {
    const { throttle, advance } = make();
    for (let i = 0; i < MAX_FAILURES; i++) throttle.recordFailure("harry");
    advance(WINDOW_MS);
    expect(throttle.retryAfterMs("harry")).toBe(0);
    throttle.recordFailure("harry");
    expect(throttle.retryAfterMs("harry")).toBe(0);
  });

  it("forgets failures on clear (a successful sign-in or reset)", () => {
    const { throttle } = make();
    for (let i = 0; i < MAX_FAILURES - 1; i++) throttle.recordFailure("harry");
    throttle.clear("harry");
    throttle.recordFailure("harry");
    expect(throttle.retryAfterMs("harry")).toBe(0);
  });
});
