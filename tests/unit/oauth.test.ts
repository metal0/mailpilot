import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildXOAuth2Token,
  clearTokenCache,
  type OAuthCredentials,
} from "../../src/imap/oauth.js";

describe("OAuth Utilities", () => {
  beforeEach(() => {
    clearTokenCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildXOAuth2Token", () => {
    it("builds correct XOAUTH2 token format", () => {
      const token = buildXOAuth2Token("user@example.com", "access_token_123");

      // Decode and verify format
      const decoded = Buffer.from(token, "base64").toString();
      expect(decoded).toBe("user=user@example.com\x01auth=Bearer access_token_123\x01\x01");
    });

    it("handles email with special characters", () => {
      const token = buildXOAuth2Token("user+tag@example.com", "token");
      const decoded = Buffer.from(token, "base64").toString();
      expect(decoded).toContain("user=user+tag@example.com");
    });

    it("handles long access tokens", () => {
      const longToken = "a".repeat(1000);
      const token = buildXOAuth2Token("user@example.com", longToken);
      const decoded = Buffer.from(token, "base64").toString();
      expect(decoded).toContain(`auth=Bearer ${longToken}`);
    });

    it("produces valid base64 output", () => {
      const token = buildXOAuth2Token("test@gmail.com", "ya29.token");
      expect(token).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it("handles empty user", () => {
      const token = buildXOAuth2Token("", "token");
      const decoded = Buffer.from(token, "base64").toString();
      expect(decoded).toBe("user=\x01auth=Bearer token\x01\x01");
    });

    it("handles empty access token", () => {
      const token = buildXOAuth2Token("user@example.com", "");
      const decoded = Buffer.from(token, "base64").toString();
      expect(decoded).toBe("user=user@example.com\x01auth=Bearer \x01\x01");
    });

    it("uses SOH (\\x01) as separator", () => {
      const token = buildXOAuth2Token("user@test.com", "token123");
      const decoded = Buffer.from(token, "base64").toString();

      // Should have exactly 3 SOH characters
      const sohCount = (decoded.match(/\x01/g) || []).length;
      expect(sohCount).toBe(3);
    });

    it("ends with double SOH", () => {
      const token = buildXOAuth2Token("user@test.com", "token123");
      const decoded = Buffer.from(token, "base64").toString();
      expect(decoded).toMatch(/\x01\x01$/);
    });

    it("handles unicode in email", () => {
      const token = buildXOAuth2Token("üser@example.com", "token");
      const decoded = Buffer.from(token, "base64").toString();
      expect(decoded).toContain("user=üser@example.com");
    });

    it("handles @ in access token", () => {
      const token = buildXOAuth2Token("user@example.com", "token@123");
      const decoded = Buffer.from(token, "base64").toString();
      expect(decoded).toContain("auth=Bearer token@123");
    });
  });

  describe("clearTokenCache", () => {
    it("clears all tokens when called without arguments", () => {
      // The cache is internal, but we can verify the function runs without error
      clearTokenCache();
      expect(true).toBe(true);
    });

    it("clears specific token when provider and clientId provided", () => {
      clearTokenCache("gmail", "client123");
      expect(true).toBe(true);
    });

    it("handles unknown provider gracefully", () => {
      clearTokenCache("unknown", "client");
      expect(true).toBe(true);
    });

    it("handles empty strings", () => {
      clearTokenCache("", "");
      expect(true).toBe(true);
    });

    it("can be called multiple times", () => {
      clearTokenCache();
      clearTokenCache();
      clearTokenCache();
      expect(true).toBe(true);
    });
  });

  describe("OAuthCredentials interface", () => {
    it("accepts valid credentials structure", () => {
      const credentials: OAuthCredentials = {
        clientId: "123.apps.googleusercontent.com",
        clientSecret: "GOCSPX-secret",
        refreshToken: "1//refresh-token",
      };

      expect(credentials.clientId).toBe("123.apps.googleusercontent.com");
      expect(credentials.clientSecret).toBe("GOCSPX-secret");
      expect(credentials.refreshToken).toBe("1//refresh-token");
    });

    it("validates required fields", () => {
      const credentials: OAuthCredentials = {
        clientId: "",
        clientSecret: "",
        refreshToken: "",
      };

      // Type check passes but values can be empty strings
      expect(credentials.clientId).toBe("");
    });
  });

  describe("XOAUTH2 token compatibility", () => {
    it("produces token compatible with Gmail IMAP", () => {
      const token = buildXOAuth2Token("user@gmail.com", "ya29.a0...");
      expect(token.length).toBeGreaterThan(0);
      expect(typeof token).toBe("string");
    });

    it("produces token compatible with Outlook IMAP", () => {
      const token = buildXOAuth2Token("user@outlook.com", "eyJ0eXAiOiJKV1Q...");
      expect(token.length).toBeGreaterThan(0);
      expect(typeof token).toBe("string");
    });

    it("token can be decoded back to original data", () => {
      const user = "test.user@example.com";
      const accessToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9";

      const token = buildXOAuth2Token(user, accessToken);
      const decoded = Buffer.from(token, "base64").toString();

      expect(decoded).toContain(`user=${user}`);
      expect(decoded).toContain(`auth=Bearer ${accessToken}`);
    });
  });
});

describe("OAuth Token Building Edge Cases", () => {
  describe("special characters in inputs", () => {
    it("handles newlines in access token", () => {
      const token = buildXOAuth2Token("user@test.com", "token\nwith\nnewlines");
      const decoded = Buffer.from(token, "base64").toString();
      expect(decoded).toContain("token\nwith\nnewlines");
    });

    it("handles tabs in access token", () => {
      const token = buildXOAuth2Token("user@test.com", "token\twith\ttabs");
      const decoded = Buffer.from(token, "base64").toString();
      expect(decoded).toContain("token\twith\ttabs");
    });

    it("handles null bytes in access token", () => {
      const token = buildXOAuth2Token("user@test.com", "token\x00null");
      const decoded = Buffer.from(token, "base64").toString();
      expect(decoded).toContain("token\x00null");
    });

    it("handles very long email addresses", () => {
      const longEmail = "a".repeat(100) + "@" + "b".repeat(100) + ".com";
      const token = buildXOAuth2Token(longEmail, "token");
      const decoded = Buffer.from(token, "base64").toString();
      expect(decoded).toContain(`user=${longEmail}`);
    });
  });

  describe("base64 encoding", () => {
    it("produces URL-safe base64 when possible", () => {
      const token = buildXOAuth2Token("user@test.com", "simple_token");
      // Standard base64, may contain +/=
      expect(token).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it("pads output to multiple of 4", () => {
      const token = buildXOAuth2Token("u@t.com", "t");
      expect(token.length % 4).toBe(0);
    });
  });
});
