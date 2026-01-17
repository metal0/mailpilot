import { describe, it, expect, beforeEach } from "vitest";
import { inflightTracker } from "../../src/utils/inflight.js";

describe("InFlightTracker", () => {
  beforeEach(() => {
    // Clear any lingering operations from other tests
    for (const op of inflightTracker.getActive()) {
      inflightTracker.complete(op.id);
    }
  });

  it("tracks operations correctly", () => {
    inflightTracker.start("op1", "Test operation 1");

    expect(inflightTracker.getCount()).toBe(1);

    const active = inflightTracker.getActive();
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe("op1");
    expect(active[0]?.description).toBe("Test operation 1");
  });

  it("completes operations correctly", () => {
    inflightTracker.start("op2", "Test operation 2");
    expect(inflightTracker.getCount()).toBe(1);

    inflightTracker.complete("op2");
    expect(inflightTracker.getCount()).toBe(0);
  });

  it("handles multiple concurrent operations", () => {
    inflightTracker.start("a", "Operation A");
    inflightTracker.start("b", "Operation B");
    inflightTracker.start("c", "Operation C");

    expect(inflightTracker.getCount()).toBe(3);

    inflightTracker.complete("b");
    expect(inflightTracker.getCount()).toBe(2);

    const active = inflightTracker.getActive();
    expect(active.map((op) => op.id).sort()).toEqual(["a", "c"]);
  });

  it("calculates duration correctly", async () => {
    inflightTracker.start("duration-test", "Duration test");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const active = inflightTracker.getActive();
    expect(active[0]?.durationMs).toBeGreaterThanOrEqual(40);

    inflightTracker.complete("duration-test");
  });

  it("waitForAll resolves immediately when no operations", async () => {
    const start = Date.now();
    const result = await inflightTracker.waitForAll(1000);
    const elapsed = Date.now() - start;

    expect(result).toBe(true);
    expect(elapsed).toBeLessThan(50);
  });

  it("waitForAll waits for operations to complete", async () => {
    inflightTracker.start("wait-test", "Wait test");

    setTimeout(() => {
      inflightTracker.complete("wait-test");
    }, 50);

    const result = await inflightTracker.waitForAll(1000);

    expect(result).toBe(true);
    expect(inflightTracker.getCount()).toBe(0);
  });

  it("waitForAll times out when operations don't complete", async () => {
    inflightTracker.start("timeout-test", "Timeout test");

    const start = Date.now();
    const result = await inflightTracker.waitForAll(100);
    const elapsed = Date.now() - start;

    expect(result).toBe(false);
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(inflightTracker.getCount()).toBe(1);

    inflightTracker.complete("timeout-test");
  });

  it("handles completing non-existent operations gracefully", () => {
    expect(() => inflightTracker.complete("nonexistent")).not.toThrow();
    expect(inflightTracker.getCount()).toBe(0);
  });
});
