import { describe, it, expect } from "vitest";
import {
  detectProvider,
  isProtonBridge,
  getProtonBridgeInstructions,
  type ProviderInfo,
} from "../../src/imap/detection.js";

describe("IMAP Provider Detection", () => {
  describe("detectProvider", () => {
    describe("Gmail detection", () => {
      const gmailHosts = [
        "imap.gmail.com",
        "IMAP.GMAIL.COM",
        "Imap.Gmail.Com",
        "imap.gmail.com:993",
      ];

      it.each(gmailHosts)("detects Gmail from host: %s", (host) => {
        const result = detectProvider(host);
        expect(result.type).toBe("gmail");
        expect(result.name).toBe("Gmail");
        expect(result.supportsIdle).toBe(true);
        expect(result.requiresOAuth).toBe(false);
      });

      it("detects Gmail regardless of case", () => {
        expect(detectProvider("IMAP.GMAIL.COM").type).toBe("gmail");
        expect(detectProvider("imap.gmail.com").type).toBe("gmail");
        expect(detectProvider("ImAp.GmAiL.CoM").type).toBe("gmail");
      });
    });

    describe("Microsoft 365 detection", () => {
      const m365Hosts = [
        "outlook.office365.com",
        "OUTLOOK.OFFICE365.COM",
        "Outlook.Office365.Com",
      ];

      it.each(m365Hosts)("detects Microsoft 365 from host: %s", (host) => {
        const result = detectProvider(host);
        expect(result.type).toBe("outlook");
        expect(result.name).toBe("Microsoft 365");
        expect(result.supportsIdle).toBe(true);
        expect(result.requiresOAuth).toBe(false);
      });
    });

    describe("Outlook.com detection", () => {
      const outlookHosts = [
        "imap-mail.outlook.com",
        "IMAP-MAIL.OUTLOOK.COM",
        "Imap-Mail.Outlook.Com",
      ];

      it.each(outlookHosts)("detects Outlook.com from host: %s", (host) => {
        const result = detectProvider(host);
        expect(result.type).toBe("outlook");
        expect(result.name).toBe("Outlook.com");
        expect(result.supportsIdle).toBe(true);
      });
    });

    describe("Fastmail detection", () => {
      const fastmailHosts = [
        "imap.fastmail.com",
        "IMAP.FASTMAIL.COM",
        "Imap.Fastmail.Com",
      ];

      it.each(fastmailHosts)("detects Fastmail from host: %s", (host) => {
        const result = detectProvider(host);
        expect(result.type).toBe("fastmail");
        expect(result.name).toBe("Fastmail");
        expect(result.supportsIdle).toBe(true);
        expect(result.requiresOAuth).toBe(false);
      });
    });

    describe("Proton Bridge detection", () => {
      it("detects Proton Bridge on 127.0.0.1:1143", () => {
        const result = detectProvider("127.0.0.1", 1143);
        expect(result.type).toBe("protonmail");
        expect(result.name).toBe("Proton Bridge (local)");
        expect(result.supportsIdle).toBe(false);
        expect(result.notes).toBeDefined();
      });

      it("detects Proton Bridge on localhost:1143", () => {
        const result = detectProvider("localhost", 1143);
        expect(result.type).toBe("protonmail");
        expect(result.name).toBe("Proton Bridge (local)");
      });

      it("does NOT detect Proton Bridge on non-standard ports", () => {
        const result993 = detectProvider("127.0.0.1", 993);
        expect(result993.type).toBe("generic");

        const result143 = detectProvider("127.0.0.1", 143);
        expect(result143.type).toBe("generic");

        const resultNoPort = detectProvider("127.0.0.1");
        expect(resultNoPort.type).toBe("generic");
      });

      it("returns generic for localhost without port 1143", () => {
        expect(detectProvider("localhost", 993).type).toBe("generic");
        expect(detectProvider("localhost", 143).type).toBe("generic");
      });
    });

    describe("Generic provider fallback", () => {
      const genericHosts = [
        "mail.example.com",
        "imap.example.org",
        "mx.company.net",
        "email.domain.io",
        "192.168.1.1",
        "10.0.0.1",
        "custom-imap-server.local",
        "mail.protonmail.ch",
        "imap.zoho.com",
        "imap.yandex.com",
        "imap.aol.com",
        "imap.mail.yahoo.com",
      ];

      it.each(genericHosts)("returns generic for unknown host: %s", (host) => {
        const result = detectProvider(host);
        expect(result.type).toBe("generic");
        expect(result.name).toBe("Generic IMAP");
        expect(result.supportsIdle).toBe(true);
        expect(result.requiresOAuth).toBe(false);
      });

      it("returns generic for empty string", () => {
        const result = detectProvider("");
        expect(result.type).toBe("generic");
      });

      it("returns generic for hosts that don't contain known patterns", () => {
        expect(detectProvider("notgmail.com").type).toBe("generic");
        expect(detectProvider("mail.example.org").type).toBe("generic");
        expect(detectProvider("imap.gmailx.com").type).toBe("generic");
        expect(detectProvider("mail.office364.com").type).toBe("generic");
      });

      it("matches known providers even in longer hostnames (substring match)", () => {
        // The regex patterns do substring matching, so these will match
        expect(detectProvider("myoutlook.office365.com.evil.com").type).toBe("outlook");
        expect(detectProvider("prefix.imap.gmail.com.suffix").type).toBe("gmail");
      });
    });

    describe("Provider info structure", () => {
      it("always returns a valid ProviderInfo object", () => {
        const hosts = [
          "imap.gmail.com",
          "outlook.office365.com",
          "unknown.server.com",
          "",
        ];

        for (const host of hosts) {
          const result = detectProvider(host);
          expect(result).toHaveProperty("type");
          expect(result).toHaveProperty("name");
          expect(result).toHaveProperty("supportsIdle");
          expect(result).toHaveProperty("requiresOAuth");
          expect(typeof result.type).toBe("string");
          expect(typeof result.name).toBe("string");
          expect(typeof result.supportsIdle).toBe("boolean");
          expect(typeof result.requiresOAuth).toBe("boolean");
        }
      });

      it("provider type is one of the valid types", () => {
        const validTypes = ["gmail", "outlook", "protonmail", "fastmail", "generic"];
        const hosts = [
          "imap.gmail.com",
          "outlook.office365.com",
          "imap-mail.outlook.com",
          "127.0.0.1",
          "imap.fastmail.com",
          "unknown.server.com",
        ];

        for (const host of hosts) {
          const result = detectProvider(host, 1143);
          expect(validTypes).toContain(result.type);
        }
      });
    });

    describe("Edge cases", () => {
      it("handles hosts with extra whitespace (substring match)", () => {
        // The regex does substring matching, so whitespace doesn't prevent matching
        expect(detectProvider(" imap.gmail.com").type).toBe("gmail");
        expect(detectProvider("imap.gmail.com ").type).toBe("gmail");
      });

      it("handles hosts with protocols in string", () => {
        // Regex patterns should still match substrings
        expect(detectProvider("ssl://imap.gmail.com").type).toBe("gmail");
      });

      it("handles null/undefined port gracefully", () => {
        const result = detectProvider("imap.gmail.com", undefined);
        expect(result.type).toBe("gmail");
      });

      it("handles negative port numbers", () => {
        const result = detectProvider("127.0.0.1", -1);
        expect(result.type).toBe("generic");
      });

      it("handles very large port numbers", () => {
        const result = detectProvider("127.0.0.1", 99999);
        expect(result.type).toBe("generic");
      });

      it("handles port 0", () => {
        const result = detectProvider("127.0.0.1", 0);
        expect(result.type).toBe("generic");
      });
    });
  });

  describe("isProtonBridge", () => {
    describe("valid Proton Bridge configurations", () => {
      it("returns true for 127.0.0.1:1143", () => {
        expect(isProtonBridge("127.0.0.1", 1143)).toBe(true);
      });

      it("returns true for 127.0.0.1:1993", () => {
        expect(isProtonBridge("127.0.0.1", 1993)).toBe(true);
      });

      it("returns true for localhost:1143", () => {
        expect(isProtonBridge("localhost", 1143)).toBe(true);
      });

      it("returns true for localhost:1993", () => {
        expect(isProtonBridge("localhost", 1993)).toBe(true);
      });
    });

    describe("invalid Proton Bridge configurations", () => {
      const invalidConfigs = [
        { host: "127.0.0.1", port: 993, desc: "127.0.0.1 with standard IMAP port" },
        { host: "127.0.0.1", port: 143, desc: "127.0.0.1 with plain IMAP port" },
        { host: "127.0.0.1", port: 587, desc: "127.0.0.1 with SMTP port" },
        { host: "127.0.0.1", port: 25, desc: "127.0.0.1 with SMTP port 25" },
        { host: "localhost", port: 993, desc: "localhost with standard IMAP port" },
        { host: "localhost", port: 143, desc: "localhost with plain IMAP port" },
        { host: "192.168.1.1", port: 1143, desc: "non-localhost IP" },
        { host: "10.0.0.1", port: 1143, desc: "private IP" },
        { host: "imap.gmail.com", port: 1143, desc: "external host with Bridge port" },
        { host: "mail.protonmail.ch", port: 1143, desc: "protonmail direct" },
        { host: "::1", port: 1143, desc: "IPv6 localhost" },
        { host: "0.0.0.0", port: 1143, desc: "wildcard IP" },
      ];

      it.each(invalidConfigs)("returns false for $desc", ({ host, port }) => {
        expect(isProtonBridge(host, port)).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("is case sensitive for localhost", () => {
        expect(isProtonBridge("LOCALHOST", 1143)).toBe(false);
        expect(isProtonBridge("LocalHost", 1143)).toBe(false);
        expect(isProtonBridge("Localhost", 1143)).toBe(false);
      });

      it("returns false for empty host", () => {
        expect(isProtonBridge("", 1143)).toBe(false);
      });

      it("returns false for negative ports", () => {
        expect(isProtonBridge("127.0.0.1", -1)).toBe(false);
        expect(isProtonBridge("localhost", -1143)).toBe(false);
      });

      it("returns false for port 0", () => {
        expect(isProtonBridge("127.0.0.1", 0)).toBe(false);
        expect(isProtonBridge("localhost", 0)).toBe(false);
      });

      it("handles very large port numbers", () => {
        expect(isProtonBridge("127.0.0.1", 65535)).toBe(false);
        expect(isProtonBridge("127.0.0.1", 999999)).toBe(false);
      });

      it("handles hosts with whitespace", () => {
        expect(isProtonBridge(" 127.0.0.1", 1143)).toBe(false);
        expect(isProtonBridge("127.0.0.1 ", 1143)).toBe(false);
        expect(isProtonBridge(" localhost", 1143)).toBe(false);
      });
    });
  });

  describe("getProtonBridgeInstructions", () => {
    it("returns a non-empty string", () => {
      const instructions = getProtonBridgeInstructions();
      expect(typeof instructions).toBe("string");
      expect(instructions.length).toBeGreaterThan(0);
    });

    it("contains download URL", () => {
      const instructions = getProtonBridgeInstructions();
      expect(instructions).toContain("https://proton.me/mail/bridge");
    });

    it("mentions Bridge-generated password", () => {
      const instructions = getProtonBridgeInstructions();
      expect(instructions).toContain("Bridge-generated password");
    });

    it("mentions IDLE is not supported", () => {
      const instructions = getProtonBridgeInstructions();
      expect(instructions).toContain("not support IDLE");
    });

    it("mentions port 1143", () => {
      const instructions = getProtonBridgeInstructions();
      expect(instructions).toContain("1143");
    });

    it("mentions port 1993", () => {
      const instructions = getProtonBridgeInstructions();
      expect(instructions).toContain("1993");
    });

    it("mentions STARTTLS and TLS options", () => {
      const instructions = getProtonBridgeInstructions();
      expect(instructions).toContain("STARTTLS");
      expect(instructions).toContain("TLS");
    });

    it("contains numbered steps", () => {
      const instructions = getProtonBridgeInstructions();
      expect(instructions).toContain("1.");
      expect(instructions).toContain("2.");
      expect(instructions).toContain("3.");
      expect(instructions).toContain("4.");
      expect(instructions).toContain("5.");
    });
  });
});
