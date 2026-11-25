import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

// Deployment config checks live in the API's (Node) test project: the web app's tsconfig is
// browser-only, and these read files from the repo.
const root = new URL("../../../", import.meta.url);
const headers = JSON.parse(
  readFileSync(new URL("apps/web/security-headers.json", root), "utf8"),
) as Record<string, string>;
const renderYaml = readFileSync(new URL("render.yaml", root), "utf8");

describe("web security headers (render.yaml vs apps/web/security-headers.json)", () => {
  it("are configured identically for Render as for vite preview", () => {
    for (const [name, value] of Object.entries(headers)) {
      if (name === "//") continue;
      expect(renderYaml, name).toContain(`name: ${name}\n        value: "${value}"`);
    }
  });

  it("only allow scripts from the app itself and forbid framing", () => {
    const csp = headers["Content-Security-Policy"]!;
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("pin the site to HTTPS and isolate it from cross-origin windows", () => {
    expect(headers["Strict-Transport-Security"]).toMatch(/max-age=\d{8,}/);
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });
});

describe("render.yaml", () => {
  it("caches the content-hashed build assets immutably", () => {
    expect(renderYaml).toContain(
      'path: /assets/*\n        name: Cache-Control\n        value: "public, max-age=31536000, immutable"',
    );
  });

  it("health-checks the API on the database-aware endpoint", () => {
    expect(renderYaml).toContain("healthCheckPath: /api/health");
  });
});
