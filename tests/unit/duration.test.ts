import { describe, it, expect } from "vitest";
import { parseDuration, formatDuration } from "../../src/utils/duration.js";

describe("parseDuration", () => {
  it("parses milliseconds", () => {
    expect(parseDuration("100ms")).toBe(100);
  });

  it("parses seconds", () => {
    expect(parseDuration("30s")).toBe(30_000);
  });

  it("parses minutes", () => {
    expect(parseDuration("5m")).toBe(5 * 60 * 1000);
  });

  it("parses hours", () => {
    expect(parseDuration("24h")).toBe(24 * 60 * 60 * 1000);
  });

  it("parses days", () => {
    expect(parseDuration("7d")).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("parses weeks", () => {
    expect(parseDuration("2w")).toBe(2 * 7 * 24 * 60 * 60 * 1000);
  });

  it("parses years", () => {
    expect(parseDuration("1y")).toBe(365 * 24 * 60 * 60 * 1000);
  });

  it("throws on invalid format", () => {
    expect(() => parseDuration("invalid")).toThrow();
    expect(() => parseDuration("30")).toThrow();
    expect(() => parseDuration("s30")).toThrow();
  });
});

describe("formatDuration", () => {
  it("formats milliseconds", () => {
    expect(formatDuration(500)).toBe("500ms");
  });

  it("formats seconds", () => {
    expect(formatDuration(30_000)).toBe("30s");
  });

  it("formats minutes", () => {
    expect(formatDuration(5 * 60 * 1000)).toBe("5m");
  });

  it("formats hours", () => {
    expect(formatDuration(12 * 60 * 60 * 1000)).toBe("12h");
  });

  it("formats days", () => {
    expect(formatDuration(7 * 24 * 60 * 60 * 1000)).toBe("7d");
  });
});
