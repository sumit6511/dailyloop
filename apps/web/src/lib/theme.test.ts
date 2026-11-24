import { describe, it, expect, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTheme } from "./use-theme";
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  saveThemePreference,
  THEME_STORAGE_KEY,
} from "./theme";
import themeInitSource from "../../public/theme-init.js?raw";

/** A matchMedia stand-in whose "prefers light" answer can be flipped, with change events. */
function fakeMatchMedia(prefersLight: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    get matches() {
      return prefersLight;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  vi.stubGlobal("matchMedia", () => query);
  return {
    set(next: boolean) {
      prefersLight = next;
      listeners.forEach((fn) => fn());
    },
  };
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
  document.head.innerHTML = "";
});

describe("theme preference", () => {
  it("defaults to following the system, and resolves system against the device", () => {
    expect(readThemePreference()).toBe("system");
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("light", false)).toBe("light");
  });

  it("remembers an explicit choice, and forgets it when going back to system", () => {
    saveThemePreference("light");
    expect(readThemePreference()).toBe("light");
    saveThemePreference("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(readThemePreference()).toBe("system");
  });

  it("ignores a stored value it doesn't recognise", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(readThemePreference()).toBe("system");
  });

  it("applies the theme to <html> and the browser chrome colour", () => {
    document.head.innerHTML = '<meta name="theme-color" content="#000000" />';
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(
      "#f3f5fa",
    );
  });
});

describe("useTheme", () => {
  it("follows the device live while set to system, and stops once a theme is chosen", () => {
    const device = fakeMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => device.set(true));
    expect(result.current.resolved).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    act(() => result.current.setPreference("dark"));
    act(() => device.set(true));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("public/theme-init.js (runs before the app, so the first paint is already themed)", () => {
  const run = () => new Function(themeInitSource)();

  it("uses the saved choice, else the device setting", () => {
    fakeMatchMedia(true);
    run();
    expect(document.documentElement.dataset.theme).toBe("light");

    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    run();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("falls back to dark where matchMedia doesn't exist", () => {
    vi.stubGlobal("matchMedia", undefined);
    run();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
