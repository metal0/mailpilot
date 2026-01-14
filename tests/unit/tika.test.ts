import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTikaClient } from "../../src/attachments/tika.js";
import type { AttachmentsConfig } from "../../src/config/schema.js";

const mockConfig: AttachmentsConfig = {
  enabled: true,
  timeout: "30s",
  max_size_mb: 10,
  max_extracted_chars: 1000,
  allowed_types: ["application/pdf"],
  extract_images: false,
  tika_url: "http://localhost:9998",
};

describe("TikaClient", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("extractText", () => {
    it("extracts text from attachment successfully", async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue("Extracted document text"),
        headers: new Map([["X-TIKA-Detected-Content-Type", "application/pdf"]]),
      };
      mockResponse.headers.get = (name: string) =>
        mockResponse.headers.get === mockResponse.headers.get
          ? (name === "X-TIKA-Detected-Content-Type" ? "application/pdf" : null)
          : null;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("Extracted document text"),
        headers: {
          get: (name: string) =>
            name === "X-TIKA-Detected-Content-Type" ? "application/pdf" : null,
        },
      });

      const client = createTikaClient(mockConfig);
      const result = await client.extractText(Buffer.from("test"), "test.pdf");

      expect(result.text).toBe("Extracted document text");
      expect(result.contentType).toBe("application/pdf");
      expect(result.truncated).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it("truncates text exceeding max_extracted_chars", async () => {
      const longText = "A".repeat(2000);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(longText),
        headers: {
          get: () => "text/plain",
        },
      });

      const client = createTikaClient(mockConfig);
      const result = await client.extractText(Buffer.from("test"), "test.txt");

      expect(result.truncated).toBe(true);
      expect(result.text.length).toBeLessThanOrEqual(1000 + 30); // Allow for truncation suffix
    });

    it("handles Tika HTTP errors", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal server error"),
      });

      const client = createTikaClient(mockConfig);
      const result = await client.extractText(
        Buffer.from("test"),
        "test.pdf"
      );

      expect(result.text).toBe("");
      expect(result.error).toContain("500");
    });

    it("handles network errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const client = createTikaClient(mockConfig);
      const result = await client.extractText(
        Buffer.from("test"),
        "test.pdf"
      );

      expect(result.text).toBe("");
      expect(result.error).toContain("Connection refused");
    });

    it("handles timeout errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("aborted"));

      const client = createTikaClient(mockConfig);
      const result = await client.extractText(
        Buffer.from("test"),
        "test.pdf"
      );

      expect(result.text).toBe("");
      expect(result.error).toContain("timeout");
    });
  });

  describe("detectType", () => {
    it("detects content type", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("application/pdf"),
      });

      const client = createTikaClient(mockConfig);
      const result = await client.detectType(Buffer.from("test"));

      expect(result).toBe("application/pdf");
    });

    it("returns fallback type on error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const client = createTikaClient(mockConfig);
      const result = await client.detectType(Buffer.from("test"));

      expect(result).toBe("application/octet-stream");
    });

    it("returns fallback type on HTTP error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const client = createTikaClient(mockConfig);
      const result = await client.detectType(Buffer.from("test"));

      expect(result).toBe("application/octet-stream");
    });
  });

  describe("isHealthy", () => {
    it("returns true when Tika is responding", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      const client = createTikaClient(mockConfig);
      const result = await client.isHealthy();

      expect(result).toBe(true);
    });

    it("returns false when Tika is not responding", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const client = createTikaClient(mockConfig);
      const result = await client.isHealthy();

      expect(result).toBe(false);
    });

    it("returns false on HTTP error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const client = createTikaClient(mockConfig);
      const result = await client.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe("configuration", () => {
    it("uses default Tika URL when not specified", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("text"),
        headers: { get: () => "text/plain" },
      });

      const configWithoutUrl = { ...mockConfig };
      delete (configWithoutUrl as Partial<AttachmentsConfig>).tika_url;

      const client = createTikaClient(configWithoutUrl as AttachmentsConfig);
      await client.extractText(Buffer.from("test"), "test.txt");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("http://localhost:9998"),
        expect.anything()
      );
    });

    it("uses configured Tika URL", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("text"),
        headers: { get: () => "text/plain" },
      });

      const configWithUrl = { ...mockConfig, tika_url: "http://tika:9999" };
      const client = createTikaClient(configWithUrl);
      await client.extractText(Buffer.from("test"), "test.txt");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("http://tika:9999"),
        expect.anything()
      );
    });
  });
});

describe("truncateAtWordBoundary", () => {
  it("truncates at word boundary when possible", async () => {
    const text = "Hello world this is a test sentence for truncation testing";

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(text),
      headers: { get: () => "text/plain" },
    });

    const shortConfig = { ...mockConfig, max_extracted_chars: 20 };
    const client = createTikaClient(shortConfig);
    const result = await client.extractText(Buffer.from("test"), "test.txt");

    // Should truncate near a word boundary
    expect(result.truncated).toBe(true);
    expect(result.text).toContain("[Content truncated...]");
  });
});
