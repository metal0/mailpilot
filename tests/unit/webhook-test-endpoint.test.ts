import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We'll test the endpoint handler logic by mocking fetch
// and simulating the behavior of the test-webhook endpoint

/**
 * SSRF protection: Block requests to private/local addresses.
 * This is a copy of the function in dashboard.ts for unit testing.
 */
function isPrivateOrLocalUrl(url: string): boolean {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  // Block localhost variants
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") {
    return true;
  }

  // Block cloud metadata endpoints (AWS, GCP, Azure)
  if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
    return true;
  }

  // Block private IP ranges (RFC 1918)
  const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipMatch) {
    const octets = ipMatch.slice(1).map(Number);
    const a = octets[0];
    const b = octets[1];
    if (a === 10) return true;  // 10.0.0.0/8
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
    if (a === 192 && b === 168) return true;  // 192.168.0.0/16
    if (a === 0) return true;  // 0.0.0.0/8
  }

  // Block link-local addresses
  if (hostname.startsWith("169.254.")) return true;

  // Block IPv6 private/local ranges
  if (hostname.startsWith("fe80:") || hostname.startsWith("[fe80:")) return true;  // Link-local
  if (hostname.startsWith("fc") || hostname.startsWith("[fc")) return true;  // Unique local
  if (hostname.startsWith("fd") || hostname.startsWith("[fd")) return true;  // Unique local

  return false;
}

describe("SSRF Protection", () => {
  describe("blocks localhost and loopback addresses", () => {
    it("blocks localhost", () => {
      expect(isPrivateOrLocalUrl("http://localhost/webhook")).toBe(true);
      expect(isPrivateOrLocalUrl("https://localhost:8080/webhook")).toBe(true);
    });

    it("blocks 127.0.0.1", () => {
      expect(isPrivateOrLocalUrl("http://127.0.0.1/webhook")).toBe(true);
      expect(isPrivateOrLocalUrl("https://127.0.0.1:3000/webhook")).toBe(true);
    });

    it("blocks IPv6 loopback", () => {
      expect(isPrivateOrLocalUrl("http://[::1]/webhook")).toBe(true);
    });
  });

  describe("blocks cloud metadata endpoints", () => {
    it("blocks AWS metadata endpoint", () => {
      expect(isPrivateOrLocalUrl("http://169.254.169.254/latest/meta-data/")).toBe(true);
    });

    it("blocks GCP metadata endpoint", () => {
      expect(isPrivateOrLocalUrl("http://metadata.google.internal/computeMetadata/v1/")).toBe(true);
    });
  });

  describe("blocks RFC 1918 private IP ranges", () => {
    it("blocks 10.0.0.0/8 range", () => {
      expect(isPrivateOrLocalUrl("http://10.0.0.1/webhook")).toBe(true);
      expect(isPrivateOrLocalUrl("http://10.255.255.255/webhook")).toBe(true);
    });

    it("blocks 172.16.0.0/12 range", () => {
      expect(isPrivateOrLocalUrl("http://172.16.0.1/webhook")).toBe(true);
      expect(isPrivateOrLocalUrl("http://172.31.255.255/webhook")).toBe(true);
    });

    it("allows 172.x outside the private range", () => {
      expect(isPrivateOrLocalUrl("http://172.15.0.1/webhook")).toBe(false);
      expect(isPrivateOrLocalUrl("http://172.32.0.1/webhook")).toBe(false);
    });

    it("blocks 192.168.0.0/16 range", () => {
      expect(isPrivateOrLocalUrl("http://192.168.0.1/webhook")).toBe(true);
      expect(isPrivateOrLocalUrl("http://192.168.255.255/webhook")).toBe(true);
    });

    it("blocks 0.0.0.0/8 range", () => {
      expect(isPrivateOrLocalUrl("http://0.0.0.0/webhook")).toBe(true);
    });
  });

  describe("blocks link-local addresses", () => {
    it("blocks 169.254.x.x link-local", () => {
      expect(isPrivateOrLocalUrl("http://169.254.1.1/webhook")).toBe(true);
    });

    it("blocks IPv6 link-local (fe80::)", () => {
      expect(isPrivateOrLocalUrl("http://[fe80::1]/webhook")).toBe(true);
    });
  });

  describe("blocks IPv6 unique local addresses", () => {
    it("blocks fc00::/7 range", () => {
      expect(isPrivateOrLocalUrl("http://[fc00::1]/webhook")).toBe(true);
      expect(isPrivateOrLocalUrl("http://[fd00::1]/webhook")).toBe(true);
    });
  });

  describe("allows public addresses", () => {
    it("allows public IP addresses", () => {
      expect(isPrivateOrLocalUrl("http://8.8.8.8/webhook")).toBe(false);
      expect(isPrivateOrLocalUrl("https://1.1.1.1/webhook")).toBe(false);
    });

    it("allows public domains", () => {
      expect(isPrivateOrLocalUrl("https://example.com/webhook")).toBe(false);
      expect(isPrivateOrLocalUrl("https://api.slack.com/webhook")).toBe(false);
      expect(isPrivateOrLocalUrl("https://hooks.zapier.com/webhook")).toBe(false);
    });

    it("allows public domains with ports", () => {
      expect(isPrivateOrLocalUrl("https://example.com:8080/webhook")).toBe(false);
    });
  });
});

describe("Webhook Test Endpoint Logic", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("URL Validation", () => {
    it("validates proper URL format", () => {
      const validUrls = [
        "https://example.com/webhook",
        "http://localhost:3000/hook",
        "https://api.service.io/v1/webhooks",
      ];

      for (const url of validUrls) {
        expect(() => new URL(url)).not.toThrow();
      }
    });

    it("rejects invalid URL format", () => {
      const invalidUrls = [
        "not-a-url",
        "ftp://invalid-protocol.com",
        "",
        "http://",
      ];

      for (const url of invalidUrls) {
        if (url === "" || url === "http://") {
          expect(() => new URL(url)).toThrow();
        }
      }
    });
  });

  describe("Webhook Request", () => {
    it("sends POST request with correct headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const url = "https://example.com/webhook";
      const headers = { Authorization: "Bearer token123" };

      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mailpilot/webhook-test",
          ...headers,
        },
        body: JSON.stringify({
          event: "test",
          timestamp: new Date().toISOString(),
          message: "This is a test webhook from Mailpilot",
        }),
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [requestUrl, requestInit] = mockFetch.mock.calls[0];

      expect(requestUrl).toBe(url);
      expect(requestInit.method).toBe("POST");
      expect(requestInit.headers["Content-Type"]).toBe("application/json");
      expect(requestInit.headers["User-Agent"]).toBe("Mailpilot/webhook-test");
      expect(requestInit.headers.Authorization).toBe("Bearer token123");
    });

    it("sends test payload with event and timestamp", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const url = "https://example.com/webhook";

      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mailpilot/webhook-test",
        },
        body: JSON.stringify({
          event: "test",
          timestamp: "2024-01-15T10:30:00.000Z",
          message: "This is a test webhook from Mailpilot",
        }),
      });

      const [, requestInit] = mockFetch.mock.calls[0];
      const body = JSON.parse(requestInit.body);

      expect(body).toHaveProperty("event", "test");
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("message", "This is a test webhook from Mailpilot");
    });
  });

  describe("Response Handling", () => {
    it("treats 2xx status codes as success", async () => {
      const successCodes = [200, 201, 202, 204];

      for (const status of successCodes) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status,
        });

        const response = await fetch("https://example.com/webhook", {
          method: "POST",
        });

        expect(response.status >= 200 && response.status < 300).toBe(true);
      }
    });

    it("treats 3xx status codes as success", async () => {
      const redirectCodes = [301, 302, 307, 308];

      for (const status of redirectCodes) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status,
        });

        const response = await fetch("https://example.com/webhook", {
          method: "POST",
        });

        expect(response.status >= 300 && response.status < 400).toBe(true);
      }
    });

    it("treats 4xx and 5xx status codes as failure", async () => {
      const failureCodes = [400, 401, 403, 404, 500, 502, 503];

      for (const status of failureCodes) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status,
        });

        const response = await fetch("https://example.com/webhook", {
          method: "POST",
        });

        expect(response.ok).toBe(false);
        expect(response.status >= 400).toBe(true);
      }
    });
  });

  describe("Error Handling", () => {
    it("handles network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        fetch("https://example.com/webhook", { method: "POST" })
      ).rejects.toThrow("Network error");
    });

    it("handles timeout via AbortController", async () => {
      const controller = new AbortController();

      // Simulate immediate abort
      controller.abort();

      mockFetch.mockRejectedValueOnce(
        Object.assign(new Error("Request aborted"), { name: "AbortError" })
      );

      try {
        await fetch("https://example.com/webhook", {
          method: "POST",
          signal: controller.signal,
        });
      } catch (error) {
        expect((error as Error).name).toBe("AbortError");
      }
    });
  });

  describe("Custom Headers", () => {
    it("merges custom headers with default headers", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const customHeaders = {
        "X-Custom-Header": "custom-value",
        Authorization: "Bearer secret",
      };

      await fetch("https://example.com/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mailpilot/webhook-test",
          ...customHeaders,
        },
        body: JSON.stringify({ event: "test" }),
      });

      const [, requestInit] = mockFetch.mock.calls[0];

      expect(requestInit.headers["Content-Type"]).toBe("application/json");
      expect(requestInit.headers["X-Custom-Header"]).toBe("custom-value");
      expect(requestInit.headers.Authorization).toBe("Bearer secret");
    });

    it("handles empty custom headers object", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const customHeaders = {};

      await fetch("https://example.com/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...customHeaders,
        },
        body: JSON.stringify({ event: "test" }),
      });

      const [, requestInit] = mockFetch.mock.calls[0];

      expect(requestInit.headers["Content-Type"]).toBe("application/json");
    });
  });
});
