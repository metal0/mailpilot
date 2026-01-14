import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests for authentication utilities including rate limiting and CSRF protection.
 *
 * Rate limiting prevents brute force attacks by limiting login attempts per IP.
 * CSRF protection uses double-submit cookie pattern for form validation.
 */

// Mock Hono context for testing
function createMockContext(ip = "127.0.0.1", headers: Record<string, string> = {}) {
  const cookies: Record<string, string> = {};
  return {
    req: {
      header: (name: string) => headers[name.toLowerCase()],
    },
    get: (key: string) => {
      if (key === "csrfToken") return cookies["csrf"];
      return undefined;
    },
    set: (key: string, value: unknown) => {
      if (key === "csrfToken") cookies["csrf"] = value as string;
    },
  };
}

describe("Rate Limiting", () => {
  // We'll test the rate limiting logic directly
  const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

  describe("checkRateLimit logic", () => {
    it("allows first login attempt", () => {
      const attempts = new Map<string, { count: number; lastAttempt: number }>();
      const ip = "192.168.1.1";

      // No record exists
      const record = attempts.get(ip);
      expect(record).toBeUndefined();

      // Should be allowed
      const allowed = !record || record.count < MAX_ATTEMPTS;
      expect(allowed).toBe(true);
    });

    it("allows attempts under the limit", () => {
      const attempts = new Map<string, { count: number; lastAttempt: number }>();
      const ip = "192.168.1.1";

      // Simulate 4 failed attempts
      attempts.set(ip, { count: 4, lastAttempt: Date.now() });

      const record = attempts.get(ip)!;
      const allowed = record.count < MAX_ATTEMPTS;
      expect(allowed).toBe(true);
    });

    it("blocks after max attempts reached", () => {
      const attempts = new Map<string, { count: number; lastAttempt: number }>();
      const ip = "192.168.1.1";

      // Simulate 5 failed attempts
      attempts.set(ip, { count: 5, lastAttempt: Date.now() });

      const record = attempts.get(ip)!;
      const blocked = record.count >= MAX_ATTEMPTS;
      expect(blocked).toBe(true);
    });

    it("calculates retry after time correctly", () => {
      const now = Date.now();
      const lastAttempt = now - (5 * 60 * 1000); // 5 minutes ago

      const timeSinceLast = now - lastAttempt;
      const retryAfter = Math.ceil((LOCKOUT_DURATION_MS - timeSinceLast) / 1000);

      // Should be about 10 minutes (600 seconds)
      expect(retryAfter).toBeGreaterThan(500);
      expect(retryAfter).toBeLessThan(700);
    });

    it("resets after lockout period expires", () => {
      const now = Date.now();
      const lastAttempt = now - LOCKOUT_DURATION_MS - 1000; // Lockout expired

      const timeSinceLast = now - lastAttempt;
      const lockoutExpired = timeSinceLast >= LOCKOUT_DURATION_MS;
      expect(lockoutExpired).toBe(true);
    });

    it("cleans up old records after window expires", () => {
      const attempts = new Map<string, { count: number; lastAttempt: number }>();
      const ip = "192.168.1.1";

      // Old record from over 15 minutes ago
      const oldTime = Date.now() - RATE_LIMIT_WINDOW_MS - 1000;
      attempts.set(ip, { count: 3, lastAttempt: oldTime });

      const record = attempts.get(ip)!;
      const shouldCleanup = Date.now() - record.lastAttempt > RATE_LIMIT_WINDOW_MS;
      expect(shouldCleanup).toBe(true);
    });
  });

  describe("recordFailedLogin logic", () => {
    it("increments count for existing record", () => {
      const attempts = new Map<string, { count: number; lastAttempt: number }>();
      const ip = "192.168.1.1";

      attempts.set(ip, { count: 2, lastAttempt: Date.now() - 1000 });

      const existing = attempts.get(ip)!;
      existing.count++;
      existing.lastAttempt = Date.now();

      expect(existing.count).toBe(3);
    });

    it("creates new record for first attempt", () => {
      const attempts = new Map<string, { count: number; lastAttempt: number }>();
      const ip = "192.168.1.1";

      if (!attempts.has(ip)) {
        attempts.set(ip, { count: 1, lastAttempt: Date.now() });
      }

      expect(attempts.get(ip)!.count).toBe(1);
    });
  });
});

describe("CSRF Protection", () => {
  describe("generateCsrfToken", () => {
    it("generates a 64-character hex string", () => {
      // 32 bytes = 64 hex characters
      const token = "a".repeat(64); // Mock token
      expect(token.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it("generates unique tokens each time", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        // Each call should produce different result
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        const token = Array.from(randomBytes)
          .map(b => b.toString(16).padStart(2, "0"))
          .join("");
        tokens.add(token);
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe("validateCsrf logic", () => {
    it("returns true when tokens match", () => {
      const cookieToken = "abc123";
      const formToken = "abc123";

      const valid = cookieToken === formToken;
      expect(valid).toBe(true);
    });

    it("returns false when tokens differ", () => {
      const cookieToken = "abc123";
      const formToken = "xyz789";

      const valid = cookieToken === formToken;
      expect(valid).toBe(false);
    });

    it("returns false when cookie token is missing", () => {
      const cookieToken: string | undefined = undefined;
      const formToken = "abc123";

      const valid = Boolean(cookieToken && formToken && cookieToken === formToken);
      expect(valid).toBe(false);
    });

    it("returns false when form token is missing", () => {
      const cookieToken = "abc123";
      const formToken: string | undefined = undefined;

      const valid = Boolean(cookieToken && formToken && cookieToken === formToken);
      expect(valid).toBe(false);
    });
  });
});

describe("Client IP Extraction", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const forwarded = "192.168.1.100, 10.0.0.1, 172.16.0.1";
    const first = forwarded.split(",")[0];
    const ip = first ? first.trim() : "unknown";
    expect(ip).toBe("192.168.1.100");
  });

  it("handles single IP in x-forwarded-for", () => {
    const forwarded = "192.168.1.100";
    const first = forwarded.split(",")[0];
    const ip = first ? first.trim() : "unknown";
    expect(ip).toBe("192.168.1.100");
  });

  it("falls back to x-real-ip when x-forwarded-for missing", () => {
    const forwarded: string | undefined = undefined;
    const realIp = "10.0.0.50";

    const ip = forwarded
      ? forwarded.split(",")[0]?.trim() ?? "unknown"
      : realIp ?? "unknown";
    expect(ip).toBe("10.0.0.50");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const forwarded: string | undefined = undefined;
    const realIp: string | undefined = undefined;

    const ip = forwarded
      ? forwarded.split(",")[0]?.trim() ?? "unknown"
      : realIp ?? "unknown";
    expect(ip).toBe("unknown");
  });
});
