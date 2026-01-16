import { describe, it, expect } from "vitest";
import { parseDuration, formatDuration } from "../../src/utils/duration.js";

describe("Duration Utilities", () => {
  describe("parseDuration", () => {
    describe("milliseconds", () => {
      it("parses milliseconds", () => {
        expect(parseDuration("100ms")).toBe(100);
      });

      it("parses 1 millisecond", () => {
        expect(parseDuration("1ms")).toBe(1);
      });

      it("parses 0 milliseconds", () => {
        expect(parseDuration("0ms")).toBe(0);
      });

      it("parses large millisecond values", () => {
        expect(parseDuration("999999ms")).toBe(999999);
      });
    });

    describe("seconds", () => {
      it("parses seconds", () => {
        expect(parseDuration("30s")).toBe(30_000);
      });

      it("parses 1 second", () => {
        expect(parseDuration("1s")).toBe(1000);
      });

      it("parses 0 seconds", () => {
        expect(parseDuration("0s")).toBe(0);
      });

      it("parses large second values", () => {
        expect(parseDuration("3600s")).toBe(3600000);
      });
    });

    describe("minutes", () => {
      it("parses minutes", () => {
        expect(parseDuration("5m")).toBe(5 * 60 * 1000);
      });

      it("parses 1 minute", () => {
        expect(parseDuration("1m")).toBe(60000);
      });

      it("parses 0 minutes", () => {
        expect(parseDuration("0m")).toBe(0);
      });

      it("parses large minute values", () => {
        expect(parseDuration("1440m")).toBe(1440 * 60 * 1000);
      });
    });

    describe("hours", () => {
      it("parses hours", () => {
        expect(parseDuration("24h")).toBe(24 * 60 * 60 * 1000);
      });

      it("parses 1 hour", () => {
        expect(parseDuration("1h")).toBe(3600000);
      });

      it("parses 0 hours", () => {
        expect(parseDuration("0h")).toBe(0);
      });

      it("parses 2 hours", () => {
        expect(parseDuration("2h")).toBe(2 * 60 * 60 * 1000);
      });
    });

    describe("days", () => {
      it("parses days", () => {
        expect(parseDuration("7d")).toBe(7 * 24 * 60 * 60 * 1000);
      });

      it("parses 1 day", () => {
        expect(parseDuration("1d")).toBe(86400000);
      });

      it("parses 0 days", () => {
        expect(parseDuration("0d")).toBe(0);
      });

      it("parses 30 days", () => {
        expect(parseDuration("30d")).toBe(30 * 24 * 60 * 60 * 1000);
      });
    });

    describe("weeks", () => {
      it("parses weeks", () => {
        expect(parseDuration("2w")).toBe(2 * 7 * 24 * 60 * 60 * 1000);
      });

      it("parses 1 week", () => {
        expect(parseDuration("1w")).toBe(7 * 24 * 60 * 60 * 1000);
      });

      it("parses 0 weeks", () => {
        expect(parseDuration("0w")).toBe(0);
      });

      it("parses 52 weeks", () => {
        expect(parseDuration("52w")).toBe(52 * 7 * 24 * 60 * 60 * 1000);
      });
    });

    describe("years", () => {
      it("parses years", () => {
        expect(parseDuration("1y")).toBe(365 * 24 * 60 * 60 * 1000);
      });

      it("parses 0 years", () => {
        expect(parseDuration("0y")).toBe(0);
      });

      it("parses 2 years", () => {
        expect(parseDuration("2y")).toBe(2 * 365 * 24 * 60 * 60 * 1000);
      });
    });

    describe("error handling", () => {
      it("throws on invalid format without unit", () => {
        expect(() => parseDuration("100")).toThrow("Invalid duration format");
      });

      it("throws on invalid format with unknown unit", () => {
        expect(() => parseDuration("100x")).toThrow("Invalid duration format");
      });

      it("throws on empty string", () => {
        expect(() => parseDuration("")).toThrow("Invalid duration format");
      });

      it("throws on negative values", () => {
        expect(() => parseDuration("-5s")).toThrow("Invalid duration format");
      });

      it("throws on decimal values", () => {
        expect(() => parseDuration("1.5h")).toThrow("Invalid duration format");
      });

      it("throws on unit only", () => {
        expect(() => parseDuration("s")).toThrow("Invalid duration format");
      });

      it("throws on whitespace prefix", () => {
        expect(() => parseDuration(" 5s")).toThrow("Invalid duration format");
      });

      it("throws on whitespace suffix", () => {
        expect(() => parseDuration("5s ")).toThrow("Invalid duration format");
      });

      it("throws on uppercase units", () => {
        expect(() => parseDuration("5S")).toThrow("Invalid duration format");
      });

      it("throws on reversed format", () => {
        expect(() => parseDuration("s30")).toThrow();
      });

      it("throws on invalid string", () => {
        expect(() => parseDuration("invalid")).toThrow();
      });

      it("includes value in error message", () => {
        expect(() => parseDuration("badvalue")).toThrow("badvalue");
      });
    });

    describe("edge cases", () => {
      it("handles very large numbers", () => {
        const result = parseDuration("999999999ms");
        expect(result).toBe(999999999);
      });

      it("returns correct values for common TTLs", () => {
        expect(parseDuration("7d")).toBe(604800000);
        expect(parseDuration("30d")).toBe(2592000000);
        expect(parseDuration("1y")).toBe(31536000000);
      });
    });
  });

  describe("formatDuration", () => {
    describe("milliseconds", () => {
      it("formats sub-second as milliseconds", () => {
        expect(formatDuration(500)).toBe("500ms");
      });

      it("formats 0 as milliseconds", () => {
        expect(formatDuration(0)).toBe("0ms");
      });

      it("formats 999ms", () => {
        expect(formatDuration(999)).toBe("999ms");
      });

      it("formats 1ms", () => {
        expect(formatDuration(1)).toBe("1ms");
      });
    });

    describe("seconds", () => {
      it("formats seconds when less than a minute", () => {
        expect(formatDuration(30_000)).toBe("30s");
      });

      it("formats exactly 1 second", () => {
        expect(formatDuration(1000)).toBe("1s");
      });

      it("formats 59 seconds", () => {
        expect(formatDuration(59000)).toBe("59s");
      });

      it("truncates sub-second values", () => {
        expect(formatDuration(1500)).toBe("1s");
      });
    });

    describe("minutes", () => {
      it("formats minutes when less than an hour", () => {
        expect(formatDuration(5 * 60 * 1000)).toBe("5m");
      });

      it("formats exactly 1 minute", () => {
        expect(formatDuration(60000)).toBe("1m");
      });

      it("formats 59 minutes", () => {
        expect(formatDuration(59 * 60 * 1000)).toBe("59m");
      });

      it("truncates sub-minute values", () => {
        expect(formatDuration(90000)).toBe("1m");
      });
    });

    describe("hours", () => {
      it("formats hours when less than a day", () => {
        expect(formatDuration(12 * 60 * 60 * 1000)).toBe("12h");
      });

      it("formats exactly 1 hour", () => {
        expect(formatDuration(3600000)).toBe("1h");
      });

      it("formats 23 hours", () => {
        expect(formatDuration(23 * 60 * 60 * 1000)).toBe("23h");
      });

      it("truncates sub-hour values", () => {
        expect(formatDuration(5400000)).toBe("1h");
      });

      it("formats 2 hours", () => {
        expect(formatDuration(7200000)).toBe("2h");
      });
    });

    describe("days", () => {
      it("formats days for large values", () => {
        expect(formatDuration(7 * 24 * 60 * 60 * 1000)).toBe("7d");
      });

      it("formats exactly 1 day", () => {
        expect(formatDuration(86400000)).toBe("1d");
      });

      it("formats 2 days", () => {
        expect(formatDuration(172800000)).toBe("2d");
      });

      it("formats 30 days", () => {
        expect(formatDuration(30 * 24 * 60 * 60 * 1000)).toBe("30d");
      });

      it("formats 365 days", () => {
        expect(formatDuration(365 * 24 * 60 * 60 * 1000)).toBe("365d");
      });

      it("truncates sub-day values", () => {
        expect(formatDuration(36 * 60 * 60 * 1000)).toBe("1d");
      });
    });

    describe("round-trip consistency", () => {
      it("milliseconds round-trip", () => {
        const input = "500ms";
        const ms = parseDuration(input);
        expect(formatDuration(ms)).toBe(input);
      });

      it("seconds round-trip", () => {
        const input = "30s";
        const ms = parseDuration(input);
        expect(formatDuration(ms)).toBe(input);
      });

      it("minutes round-trip", () => {
        const input = "15m";
        const ms = parseDuration(input);
        expect(formatDuration(ms)).toBe(input);
      });

      it("hours round-trip", () => {
        const input = "6h";
        const ms = parseDuration(input);
        expect(formatDuration(ms)).toBe(input);
      });

      it("days round-trip", () => {
        const input = "7d";
        const ms = parseDuration(input);
        expect(formatDuration(ms)).toBe(input);
      });
    });
  });
});
