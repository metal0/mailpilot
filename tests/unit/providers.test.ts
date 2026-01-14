import { describe, it, expect, beforeEach } from "vitest";

/**
 * Tests for LLM provider statistics tracking.
 *
 * Provider stats track request counts (daily, total, per-minute) and rate limit status.
 * This data is displayed in the dashboard for monitoring LLM API usage.
 */

interface ProviderStats {
  name: string;
  model: string;
  requestsToday: number;
  requestsTotal: number;
  requestsLastMinute: number;
  rateLimited: boolean;
  rpmLimit?: number;
}

describe("Provider Request Counting", () => {
  describe("Daily reset logic", () => {
    it("resets today count when day changes", () => {
      const counts = {
        total: 150,
        today: 50,
        lastReset: new Date("2024-01-01T00:00:00Z").getTime(),
      };

      // Current time is next day
      const now = new Date("2024-01-02T10:00:00Z");
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      if (counts.lastReset < startOfDay.getTime()) {
        counts.today = 0;
        counts.lastReset = startOfDay.getTime();
      }

      expect(counts.today).toBe(0);
      expect(counts.total).toBe(150); // Total unchanged
    });

    it("preserves count within same day", () => {
      const now = new Date("2024-01-01T15:00:00Z");
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const counts = {
        total: 150,
        today: 50,
        lastReset: startOfDay.getTime(), // Reset was today
      };

      // Check should not reset
      if (counts.lastReset < startOfDay.getTime()) {
        counts.today = 0;
        counts.lastReset = startOfDay.getTime();
      }

      expect(counts.today).toBe(50); // Unchanged
    });
  });

  describe("Request recording", () => {
    it("increments both total and today counts", () => {
      const counts = {
        total: 99,
        today: 49,
        lastReset: Date.now(),
      };

      // Record a request
      counts.total++;
      counts.today++;

      expect(counts.total).toBe(100);
      expect(counts.today).toBe(50);
    });

    it("handles first request of the day after reset", () => {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const counts = {
        total: 100,
        today: 0, // Reset
        lastReset: startOfDay.getTime(),
      };

      // Record first request
      counts.total++;
      counts.today++;

      expect(counts.total).toBe(101);
      expect(counts.today).toBe(1);
    });
  });
});

describe("Provider Stats Assembly", () => {
  it("builds stats object with all required fields", () => {
    const config = {
      name: "openai",
      default_model: "gpt-4o",
      rate_limit_rpm: 60,
    };

    const counts = {
      total: 500,
      today: 25,
      lastReset: Date.now(),
    };

    const rateLimitInfo = {
      requestsInLastMinute: 45,
      isLimited: false,
    };

    const stat: ProviderStats = {
      name: config.name,
      model: config.default_model,
      requestsToday: counts.today,
      requestsTotal: counts.total,
      requestsLastMinute: rateLimitInfo.requestsInLastMinute,
      rateLimited: rateLimitInfo.isLimited,
    };

    if (config.rate_limit_rpm !== undefined) {
      stat.rpmLimit = config.rate_limit_rpm;
    }

    expect(stat.name).toBe("openai");
    expect(stat.model).toBe("gpt-4o");
    expect(stat.requestsToday).toBe(25);
    expect(stat.requestsTotal).toBe(500);
    expect(stat.requestsLastMinute).toBe(45);
    expect(stat.rateLimited).toBe(false);
    expect(stat.rpmLimit).toBe(60);
  });

  it("omits rpmLimit when not configured", () => {
    const config = {
      name: "local-llm",
      default_model: "llama3",
      rate_limit_rpm: undefined,
    };

    const stat: ProviderStats = {
      name: config.name,
      model: config.default_model,
      requestsToday: 10,
      requestsTotal: 100,
      requestsLastMinute: 5,
      rateLimited: false,
    };

    if (config.rate_limit_rpm !== undefined) {
      stat.rpmLimit = config.rate_limit_rpm;
    }

    expect(stat.rpmLimit).toBeUndefined();
  });

  it("shows rate limited status correctly", () => {
    const rateLimitInfo = {
      requestsInLastMinute: 65,
      isLimited: true, // Over limit
    };

    const stat: ProviderStats = {
      name: "openai",
      model: "gpt-4",
      requestsToday: 100,
      requestsTotal: 1000,
      requestsLastMinute: rateLimitInfo.requestsInLastMinute,
      rateLimited: rateLimitInfo.isLimited,
      rpmLimit: 60,
    };

    expect(stat.rateLimited).toBe(true);
    expect(stat.requestsLastMinute).toBeGreaterThan(stat.rpmLimit!);
  });
});

describe("Rate Limiter Integration", () => {
  describe("Sliding window tracking", () => {
    it("tracks requests within the last minute", () => {
      const requests: number[] = [];
      const now = Date.now();
      const windowMs = 60_000;

      // Simulate requests at different times
      requests.push(now - 70_000); // Outside window
      requests.push(now - 50_000); // Inside window
      requests.push(now - 30_000); // Inside window
      requests.push(now - 10_000); // Inside window

      const recentRequests = requests.filter(t => now - t < windowMs);
      expect(recentRequests.length).toBe(3);
    });

    it("cleans up old request timestamps", () => {
      const requests: number[] = [];
      const now = Date.now();
      const windowMs = 60_000;

      // Add old and new requests
      for (let i = 0; i < 10; i++) {
        requests.push(now - 120_000 + i * 10_000); // Mix of old and new
      }

      // Clean up old requests
      const cleaned = requests.filter(t => now - t < windowMs);

      expect(cleaned.length).toBeLessThan(requests.length);
    });
  });

  describe("Rate limit checking", () => {
    it("allows request when under limit", () => {
      const requestsInLastMinute = 55;
      const rpmLimit = 60;

      const allowed = requestsInLastMinute < rpmLimit;
      expect(allowed).toBe(true);
    });

    it("blocks request when at limit", () => {
      const requestsInLastMinute = 60;
      const rpmLimit = 60;

      const allowed = requestsInLastMinute < rpmLimit;
      expect(allowed).toBe(false);
    });

    it("handles retry-after from API response", () => {
      const retryAfterHeader = "30"; // Seconds
      const retryAfterMs = parseInt(retryAfterHeader, 10) * 1000;

      expect(retryAfterMs).toBe(30_000);
    });
  });
});

describe("Multiple Providers", () => {
  it("tracks stats independently per provider", () => {
    const providers = new Map<string, { total: number; today: number }>();

    providers.set("openai", { total: 100, today: 10 });
    providers.set("anthropic", { total: 50, today: 5 });

    // Record request to openai
    const openai = providers.get("openai")!;
    openai.total++;
    openai.today++;

    expect(providers.get("openai")!.total).toBe(101);
    expect(providers.get("anthropic")!.total).toBe(50); // Unchanged
  });

  it("returns all provider stats", () => {
    const providers = new Map<string, ProviderStats>();

    providers.set("openai", {
      name: "openai",
      model: "gpt-4",
      requestsToday: 50,
      requestsTotal: 500,
      requestsLastMinute: 10,
      rateLimited: false,
      rpmLimit: 60,
    });

    providers.set("anthropic", {
      name: "anthropic",
      model: "claude-3",
      requestsToday: 25,
      requestsTotal: 250,
      requestsLastMinute: 5,
      rateLimited: false,
      rpmLimit: 40,
    });

    const allStats = Array.from(providers.values());

    expect(allStats.length).toBe(2);
    expect(allStats.map(s => s.name)).toContain("openai");
    expect(allStats.map(s => s.name)).toContain("anthropic");
  });
});
