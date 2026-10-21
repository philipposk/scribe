import { afterEach, describe, expect, it } from "vitest";
import { authenticateBearer } from "@/lib/auth";

const originalKeys = process.env.SCRIBE_APP_KEYS;

afterEach(() => {
  if (originalKeys === undefined) {
    delete process.env.SCRIBE_APP_KEYS;
  } else {
    process.env.SCRIBE_APP_KEYS = originalKeys;
  }
});

describe("authenticateBearer", () => {
  it("rejects when SCRIBE_APP_KEYS is not configured", () => {
    delete process.env.SCRIBE_APP_KEYS;
    const result = authenticateBearer("Bearer secret", new Map());
    expect(result).toEqual({
      ok: false,
      status: 503,
      message: "Service not configured: SCRIBE_APP_KEYS is empty",
    });
  });

  it("rejects missing Authorization header", () => {
    const index = new Map([["key-sparks", "sparks"]]);
    expect(authenticateBearer(null, index).ok).toBe(false);
    expect(authenticateBearer(null, index)).toMatchObject({ status: 401 });
  });

  it("rejects invalid token", () => {
    const index = new Map([["key-sparks", "sparks"]]);
    const result = authenticateBearer("Bearer wrong", index);
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("accepts valid bearer token", () => {
    const index = new Map([["key-sparks", "sparks"]]);
    const result = authenticateBearer("Bearer key-sparks", index);
    expect(result).toEqual({ ok: true, appId: "sparks" });
  });
});
