import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getRateLimiter,
  acquireRateLimit,
  handleRateLimitResponse,
  getRateLimitStats,
} from "../../src/llm/rate-limiter.js";

describe("Rate Limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getRateLimiter", () => {
    it("creates a new limiter for unknown API URL", () => {
      const state = getRateLimiter("https://api.new-provider.com");
      expect(state).toEqual({ requests: [], retryAfter: null });
    });

    it("returns the same limiter for the same API URL", () => {
      const state1 = getRateLimiter("https://api.example.com");
      const state2 = getRateLimiter("https://api.example.com");
      expect(state1).toBe(state2);
    });

    it("returns different limiters for different API URLs", () => {
      const state1 = getRateLimiter("https://api.provider1.com");
      const state2 = getRateLimiter("https://api.provider2.com");
      expect(state1).not.toBe(state2);
    });

    it("initializes with empty requests array", () => {
      const state = getRateLimiter("https://api.clean.com");
      expect(state.requests).toHaveLength(0);
    });

    it("initializes with null retryAfter", () => {
      const state = getRateLimiter("https://api.clean2.com");
      expect(state.retryAfter).toBeNull();
    });
  });

  describe("acquireRateLimit", () => {
    it("records request timestamp when acquiring", async () => {
      const apiUrl = "https://api.record-test.com";
      await acquireRateLimit(apiUrl);

      const state = getRateLimiter(apiUrl);
      expect(state.requests).toHaveLength(1);
      expect(state.requests[0]).toBe(Date.now());
    });

    it("records multiple request timestamps", async () => {
      const apiUrl = "https://api.multi-record.com";
      await acquireRateLimit(apiUrl);
      vi.advanceTimersByTime(100);
      await acquireRateLimit(apiUrl);
      vi.advanceTimersByTime(100);
      await acquireRateLimit(apiUrl);

      const state = getRateLimiter(apiUrl);
      expect(state.requests).toHaveLength(3);
    });

    it("respects RPM limit by waiting when limit reached", async () => {
      const apiUrl = "https://api.rpm-limit.com";
      const rpmLimit = 3;

      // Make 3 requests to hit the limit
      await acquireRateLimit(apiUrl, rpmLimit);
      vi.advanceTimersByTime(100);
      await acquireRateLimit(apiUrl, rpmLimit);
      vi.advanceTimersByTime(100);
      await acquireRateLimit(apiUrl, rpmLimit);

      const state = getRateLimiter(apiUrl);
      expect(state.requests).toHaveLength(3);
    });

    it("waits for retryAfter when rate limited", async () => {
      const apiUrl = "https://api.retry-after.com";

      // Set retry after
      handleRateLimitResponse(apiUrl, 5);

      const startTime = Date.now();
      const promise = acquireRateLimit(apiUrl);

      // Advance time past retryAfter
      vi.advanceTimersByTime(5000);
      await promise;

      const state = getRateLimiter(apiUrl);
      expect(state.retryAfter).toBeNull();
    });

    it("cleans up old requests outside 60s window", async () => {
      const apiUrl = "https://api.cleanup.com";
      const rpmLimit = 100;

      // Make a request
      await acquireRateLimit(apiUrl, rpmLimit);

      // Advance 61 seconds
      vi.advanceTimersByTime(61000);

      // Make another request (this should clean up the old one)
      await acquireRateLimit(apiUrl, rpmLimit);

      const state = getRateLimiter(apiUrl);
      expect(state.requests).toHaveLength(1);
    });

    it("does not enforce RPM limit when not provided", async () => {
      const apiUrl = "https://api.no-rpm.com";

      // Make many requests without RPM limit
      for (let i = 0; i < 100; i++) {
        await acquireRateLimit(apiUrl);
      }

      const state = getRateLimiter(apiUrl);
      expect(state.requests).toHaveLength(100);
    });
  });

  describe("handleRateLimitResponse", () => {
    it("sets retryAfter with provided seconds", () => {
      const apiUrl = "https://api.set-retry.com";
      handleRateLimitResponse(apiUrl, 30);

      const state = getRateLimiter(apiUrl);
      expect(state.retryAfter).toBe(Date.now() + 30000);
    });

    it("defaults to 60 seconds when retryAfterSeconds not provided", () => {
      const apiUrl = "https://api.default-retry.com";
      handleRateLimitResponse(apiUrl);

      const state = getRateLimiter(apiUrl);
      expect(state.retryAfter).toBe(Date.now() + 60000);
    });

    it("defaults to 60 seconds when retryAfterSeconds is 0", () => {
      const apiUrl = "https://api.zero-retry.com";
      handleRateLimitResponse(apiUrl, 0);

      const state = getRateLimiter(apiUrl);
      expect(state.retryAfter).toBe(Date.now() + 60000);
    });

    it("overwrites previous retryAfter", () => {
      const apiUrl = "https://api.overwrite-retry.com";
      handleRateLimitResponse(apiUrl, 10);
      handleRateLimitResponse(apiUrl, 20);

      const state = getRateLimiter(apiUrl);
      expect(state.retryAfter).toBe(Date.now() + 20000);
    });

    it("handles large retry values", () => {
      const apiUrl = "https://api.large-retry.com";
      handleRateLimitResponse(apiUrl, 3600); // 1 hour

      const state = getRateLimiter(apiUrl);
      expect(state.retryAfter).toBe(Date.now() + 3600000);
    });
  });

  describe("getRateLimitStats", () => {
    it("returns zero requests when no requests made", () => {
      const stats = getRateLimitStats("https://api.no-requests.com");
      expect(stats.requestsInLastMinute).toBe(0);
      expect(stats.isLimited).toBe(false);
    });

    it("counts requests in last minute", async () => {
      const apiUrl = "https://api.count-requests.com";
      await acquireRateLimit(apiUrl);
      await acquireRateLimit(apiUrl);
      await acquireRateLimit(apiUrl);

      const stats = getRateLimitStats(apiUrl);
      expect(stats.requestsInLastMinute).toBe(3);
    });

    it("excludes requests older than 60 seconds", async () => {
      const apiUrl = "https://api.old-requests.com";

      await acquireRateLimit(apiUrl);
      vi.advanceTimersByTime(30000); // 30 seconds
      await acquireRateLimit(apiUrl);
      vi.advanceTimersByTime(35000); // 65 seconds total
      await acquireRateLimit(apiUrl);

      const stats = getRateLimitStats(apiUrl);
      // First request is now > 60s old, should not be counted
      expect(stats.requestsInLastMinute).toBe(2);
    });

    it("reports isLimited true when retryAfter is in future", () => {
      const apiUrl = "https://api.limited-stats.com";
      handleRateLimitResponse(apiUrl, 30);

      const stats = getRateLimitStats(apiUrl);
      expect(stats.isLimited).toBe(true);
    });

    it("reports isLimited false when retryAfter is in past", () => {
      const apiUrl = "https://api.expired-limit.com";
      handleRateLimitResponse(apiUrl, 10);
      vi.advanceTimersByTime(15000); // Past retryAfter

      const stats = getRateLimitStats(apiUrl);
      expect(stats.isLimited).toBe(false);
    });

    it("reports isLimited false when retryAfter is null", () => {
      const apiUrl = "https://api.no-limit.com";

      const stats = getRateLimitStats(apiUrl);
      expect(stats.isLimited).toBe(false);
    });
  });

  describe("integration scenarios", () => {
    it("simulates burst of requests at RPM limit", async () => {
      const apiUrl = "https://api.burst-test.com";
      const rpmLimit = 5;

      // Make 5 requests rapidly
      for (let i = 0; i < 5; i++) {
        await acquireRateLimit(apiUrl, rpmLimit);
      }

      const stats = getRateLimitStats(apiUrl);
      expect(stats.requestsInLastMinute).toBe(5);
    });

    it("handles rate limit then recovery", async () => {
      const apiUrl = "https://api.recovery-test.com";

      // Get rate limited
      handleRateLimitResponse(apiUrl, 5);
      expect(getRateLimitStats(apiUrl).isLimited).toBe(true);

      // Wait for recovery
      vi.advanceTimersByTime(6000);
      expect(getRateLimitStats(apiUrl).isLimited).toBe(false);
    });

    it("handles multiple providers independently", async () => {
      const apiUrl1 = "https://api.provider1.com";
      const apiUrl2 = "https://api.provider2.com";

      await acquireRateLimit(apiUrl1);
      await acquireRateLimit(apiUrl1);
      await acquireRateLimit(apiUrl2);

      expect(getRateLimitStats(apiUrl1).requestsInLastMinute).toBe(2);
      expect(getRateLimitStats(apiUrl2).requestsInLastMinute).toBe(1);
    });

    it("rate limit on one provider does not affect another", () => {
      const apiUrl1 = "https://api.limited-provider.com";
      const apiUrl2 = "https://api.free-provider.com";

      handleRateLimitResponse(apiUrl1, 60);

      expect(getRateLimitStats(apiUrl1).isLimited).toBe(true);
      expect(getRateLimitStats(apiUrl2).isLimited).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles empty string API URL", () => {
      const state = getRateLimiter("");
      expect(state).toEqual({ requests: [], retryAfter: null });
    });

    it("handles URL with query parameters", async () => {
      const apiUrl = "https://api.example.com?version=v1";
      await acquireRateLimit(apiUrl);

      const stats = getRateLimitStats(apiUrl);
      expect(stats.requestsInLastMinute).toBe(1);
    });

    it("handles URL with port", async () => {
      const apiUrl = "https://api.example.com:8443/v1";
      await acquireRateLimit(apiUrl);

      const stats = getRateLimitStats(apiUrl);
      expect(stats.requestsInLastMinute).toBe(1);
    });

    it("treats URLs as case-sensitive", () => {
      const state1 = getRateLimiter("https://API.example.com");
      const state2 = getRateLimiter("https://api.example.com");
      expect(state1).not.toBe(state2);
    });

    it("handles very high RPM limits", async () => {
      const apiUrl = "https://api.high-rpm.com";
      const rpmLimit = 1000000;

      await acquireRateLimit(apiUrl, rpmLimit);
      const stats = getRateLimitStats(apiUrl);
      expect(stats.requestsInLastMinute).toBe(1);
    });

    it("handles RPM limit of 1", async () => {
      const apiUrl = "https://api.single-rpm.com";
      const rpmLimit = 1;

      await acquireRateLimit(apiUrl, rpmLimit);
      const stats = getRateLimitStats(apiUrl);
      expect(stats.requestsInLastMinute).toBe(1);
    });
  });
});
