import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateNextRetryDelay } from "../../src/storage/retry-manager.js";

describe("retry-manager", () => {
  describe("calculateNextRetryDelay", () => {
    beforeEach(() => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("returns initial delay on first attempt", () => {
      const delay = calculateNextRetryDelay(1, 5000, 86400000, 2);
      // 5000 * 2^0 = 5000, with 5% jitter (0.5 * 0.1 * 5000 = 250)
      expect(delay).toBe(5250);
    });

    it("doubles delay on second attempt with multiplier 2", () => {
      const delay = calculateNextRetryDelay(2, 5000, 86400000, 2);
      // 5000 * 2^1 = 10000, with 5% jitter
      expect(delay).toBe(10500);
    });

    it("applies backoff multiplier correctly", () => {
      const delay = calculateNextRetryDelay(3, 5000, 86400000, 2);
      // 5000 * 2^2 = 20000, with 5% jitter
      expect(delay).toBe(21000);
    });

    it("respects max delay cap", () => {
      const delay = calculateNextRetryDelay(10, 5000, 30000, 2);
      // 5000 * 2^9 = 2,560,000 but capped at 30000
      expect(delay).toBe(30000);
    });

    it("handles custom backoff multiplier", () => {
      const delay = calculateNextRetryDelay(2, 1000, 100000, 3);
      // 1000 * 3^1 = 3000, with 5% jitter
      expect(delay).toBe(3150);
    });

    it("adds jitter within 10% range", () => {
      // Test with different random values
      vi.spyOn(Math, "random").mockReturnValue(0);
      const delayNoJitter = calculateNextRetryDelay(1, 10000, 100000, 2);
      expect(delayNoJitter).toBe(10000);

      vi.spyOn(Math, "random").mockReturnValue(1);
      const delayMaxJitter = calculateNextRetryDelay(1, 10000, 100000, 2);
      expect(delayMaxJitter).toBe(11000); // 10000 + 10% jitter
    });
  });
});
