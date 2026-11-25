import { describe, expect, it } from "vitest";
import { DEFAULT_API_URL, resolveApiUrl } from "./api-url";

describe("resolveApiUrl", () => {
  it("keeps a full URL as given", () => {
    expect(resolveApiUrl("https://api.example.com/api")).toBe("https://api.example.com/api");
    expect(resolveApiUrl("http://localhost:4100/api")).toBe("http://localhost:4100/api");
  });

  it("turns a bare host (as Render provides) into its https API URL", () => {
    expect(resolveApiUrl("dailyloop-api.onrender.com")).toBe(
      "https://dailyloop-api.onrender.com/api",
    );
  });

  it("falls back to the local API when unset or blank", () => {
    expect(resolveApiUrl(undefined)).toBe(DEFAULT_API_URL);
    expect(resolveApiUrl("  ")).toBe(DEFAULT_API_URL);
  });
});
