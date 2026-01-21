import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as net from "node:net";
import * as tls from "node:tls";
import {
  probeImapPort,
  probeTlsCertificate,
  detectImapProvider,
  type PortProbeResult,
  type TlsProbeResult,
} from "../../src/imap/probe.js";

// Mock TLS module for certificate testing
vi.mock("node:tls", async () => {
  const actual = await vi.importActual<typeof tls>("node:tls");
  return {
    ...actual,
    connect: vi.fn(),
  };
});

describe("IMAP Probing", () => {
  describe("detectImapProvider", () => {
    describe("Gmail detection", () => {
      it("detects Gmail from host containing 'gmail'", () => {
        const result = detectImapProvider("imap.gmail.com");
        expect(result.name).toBe("Gmail");
        expect(result.type).toBe("gmail");
        expect(result.oauthSupported).toBe(true);
      });

      it("detects Gmail from host containing 'google'", () => {
        const result = detectImapProvider("mail.google.com");
        expect(result.name).toBe("Gmail");
        expect(result.type).toBe("gmail");
      });

      it("is case insensitive", () => {
        expect(detectImapProvider("IMAP.GMAIL.COM").type).toBe("gmail");
        expect(detectImapProvider("imap.Gmail.Com").type).toBe("gmail");
      });
    });

    describe("Microsoft detection", () => {
      it("detects Outlook from host containing 'outlook'", () => {
        const result = detectImapProvider("outlook.office365.com");
        expect(result.name).toBe("Microsoft Outlook");
        expect(result.type).toBe("outlook");
        expect(result.oauthSupported).toBe(true);
      });

      it("detects Outlook from host containing 'office365'", () => {
        const result = detectImapProvider("mail.office365.com");
        expect(result.type).toBe("outlook");
      });

      it("detects Outlook from host containing 'microsoft'", () => {
        const result = detectImapProvider("imap.microsoft.com");
        expect(result.type).toBe("outlook");
      });
    });

    describe("Yahoo detection", () => {
      it("detects Yahoo from host containing 'yahoo'", () => {
        const result = detectImapProvider("imap.mail.yahoo.com");
        expect(result.name).toBe("Yahoo Mail");
        expect(result.type).toBe("yahoo");
        expect(result.oauthSupported).toBe(true);
      });
    });

    describe("Fastmail detection", () => {
      it("detects Fastmail from host containing 'fastmail'", () => {
        const result = detectImapProvider("imap.fastmail.com");
        expect(result.name).toBe("Fastmail");
        expect(result.type).toBe("fastmail");
        expect(result.oauthSupported).toBe(false);
      });
    });

    describe("Zoho detection", () => {
      it("detects Zoho from host containing 'zoho'", () => {
        const result = detectImapProvider("imap.zoho.com");
        expect(result.name).toBe("Zoho Mail");
        expect(result.type).toBe("zoho");
        expect(result.oauthSupported).toBe(true);
      });
    });

    describe("iCloud detection", () => {
      it("detects iCloud from host containing 'icloud'", () => {
        const result = detectImapProvider("imap.mail.icloud.com");
        expect(result.name).toBe("iCloud Mail");
        expect(result.type).toBe("icloud");
        expect(result.oauthSupported).toBe(false);
      });

      it("detects iCloud from host containing 'apple'", () => {
        expect(detectImapProvider("imap.apple.com").type).toBe("icloud");
      });

      it("detects iCloud from host containing 'me.com'", () => {
        expect(detectImapProvider("imap.mail.me.com").type).toBe("icloud");
      });
    });

    describe("Generic provider fallback", () => {
      const genericHosts = [
        "mail.example.com",
        "imap.example.org",
        "mx.company.net",
        "192.168.1.1",
        "10.0.0.1",
        "localhost",
        "127.0.0.1",
        "custom-mail.internal",
      ];

      it.each(genericHosts)("returns generic for unknown host: %s", (host) => {
        const result = detectImapProvider(host);
        expect(result.name).toBe("Generic IMAP");
        expect(result.type).toBe("generic");
        expect(result.requiresOAuth).toBe(false);
        expect(result.oauthSupported).toBe(false);
      });

      it("returns generic for empty string", () => {
        expect(detectImapProvider("").type).toBe("generic");
      });
    });

    describe("Provider info structure", () => {
      it("always returns a valid object with all required properties", () => {
        const hosts = ["imap.gmail.com", "outlook.office365.com", "unknown.com", ""];
        for (const host of hosts) {
          const result = detectImapProvider(host);
          expect(result).toHaveProperty("name");
          expect(result).toHaveProperty("type");
          expect(result).toHaveProperty("requiresOAuth");
          expect(result).toHaveProperty("oauthSupported");
          expect(typeof result.name).toBe("string");
          expect(typeof result.type).toBe("string");
          expect(typeof result.requiresOAuth).toBe("boolean");
          expect(typeof result.oauthSupported).toBe("boolean");
        }
      });
    });
  });

  describe("probeImapPort", () => {
    describe("timeout behavior", () => {
      it("returns failure when connection times out", async () => {
        const result = await probeImapPort("192.0.2.1", 993, "tls", 100);
        expect(result.success).toBe(false);
        expect(result.port).toBe(993);
        expect(result.tls).toBe("tls");
      }, 5000);

      it("returns failure for non-existent host", async () => {
        const result = await probeImapPort("this-host-does-not-exist.invalid", 993, "tls", 500);
        expect(result.success).toBe(false);
      }, 5000);
    });

    describe("port probe result structure", () => {
      it("returns all expected fields on timeout", async () => {
        const result = await probeImapPort("192.0.2.1", 143, "starttls", 100);
        expect(result).toHaveProperty("port");
        expect(result).toHaveProperty("tls");
        expect(result).toHaveProperty("success");
        expect(result.port).toBe(143);
        expect(result.tls).toBe("starttls");
      }, 5000);
    });

    describe("invalid server detection", () => {
      it("does not succeed for invalid hosts", async () => {
        const invalidHosts = [
          "this-definitely-does-not-exist.invalid",
          "no-such-domain.test",
          "192.0.2.1", // TEST-NET-1, should not respond
        ];

        for (const host of invalidHosts) {
          const result = await probeImapPort(host, 993, "tls", 200);
          expect(result.success).toBe(false);
        }
      }, 10000);
    });
  });

  describe("probeTlsCertificate", () => {
    describe("timeout behavior", () => {
      it("returns failure with TIMEOUT error code when connection times out", async () => {
        const result = await probeTlsCertificate("192.0.2.1", 993, 100);
        expect(result.success).toBe(false);
        expect(result.errorCode).toBe("TIMEOUT");
        expect(result.error).toContain("timed out");
      }, 5000);
    });

    describe("connection error handling", () => {
      it("returns failure for non-existent host", async () => {
        const result = await probeTlsCertificate("this-host-does-not-exist.invalid", 993, 500);
        expect(result.success).toBe(false);
      }, 5000);
    });

    describe("result structure", () => {
      it("always returns success and error fields", async () => {
        const result = await probeTlsCertificate("192.0.2.1", 993, 100);
        expect(result).toHaveProperty("success");
        expect(typeof result.success).toBe("boolean");
      }, 5000);

      it("includes errorCode on failure", async () => {
        const result = await probeTlsCertificate("192.0.2.1", 993, 100);
        expect(result.success).toBe(false);
        expect(result.errorCode).toBeDefined();
      }, 5000);
    });

    describe("self-signed certificate handling", () => {
      let mockTlsSocket: any;

      beforeEach(() => {
        // Mock TLS socket behavior
        mockTlsSocket = {
          on: vi.fn(),
          destroy: vi.fn(),
          getPeerCertificate: vi.fn(),
        };
        // Reset the mock before each test
        vi.mocked(tls.connect).mockReset();
      });

      afterEach(() => {
        vi.clearAllMocks();
      });

      it("should retrieve certificate info even when unsafeSocket encounters an error", async () => {
        // #given - Mock a self-signed cert error followed by successful cert retrieval
        let socketErrorHandler: any;
        let unsafeSocketErrorHandler: any;

        vi.mocked(tls.connect).mockImplementation((options: any, callback?: () => void) => {
          const socket = {
            on: vi.fn((event: string, handler: any) => {
              if (event === "error") {
                if (options.rejectUnauthorized === true) {
                  // First socket - trigger self-signed error
                  socketErrorHandler = handler;
                  setTimeout(() => {
                    const error = new Error("self-signed certificate") as NodeJS.ErrnoException;
                    error.code = "DEPTH_ZERO_SELF_SIGNED_CERT";
                    socketErrorHandler(error);
                  }, 10);
                } else {
                  // Unsafe socket - also has error but has cert
                  unsafeSocketErrorHandler = handler;
                  setTimeout(() => {
                    const error = new Error("self-signed certificate");
                    unsafeSocketErrorHandler(error);
                  }, 10);
                }
              }
              return socket;
            }),
            destroy: vi.fn(),
            getPeerCertificate: vi.fn(() => ({
              fingerprint256: "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99",
              subject: { CN: "test.example.com", O: "Test Org" },
              issuer: { CN: "test.example.com", O: "Test Org" },
              valid_from: "Jan  1 00:00:00 2024 GMT",
              valid_to: "Dec 31 23:59:59 2025 GMT",
            })),
          };
          if (callback && options.rejectUnauthorized === false) {
            // Unsafe socket connects
            setTimeout(callback, 5);
          }
          return socket;
        });

        // #when
        const result = await probeTlsCertificate("test.example.com", 993, 1000);

        // #then
        expect(result.success).toBe(false);
        expect(result.certificateInfo).toBeDefined();
        expect(result.certificateInfo?.fingerprint256).toBe("AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99");
        expect(result.certificateInfo?.selfSigned).toBe(true);
        expect(result.error).toBe("Self-signed certificate");
        expect(result.errorCode).toBe("DEPTH_ZERO_SELF_SIGNED_CERT");
      }, 5000);

      it("should handle case where unsafeSocket error occurs before cert retrieval", async () => {
        // #given - Mock immediate error on unsafeSocket without cert
        vi.mocked(tls.connect).mockImplementation((options: any) => {
          const socket = {
            on: vi.fn((event: string, handler: any) => {
              if (event === "error") {
                setTimeout(() => {
                  const error = new Error("self-signed certificate") as NodeJS.ErrnoException;
                  error.code = "DEPTH_ZERO_SELF_SIGNED_CERT";
                  handler(error);
                }, 10);
              }
              return socket;
            }),
            destroy: vi.fn(),
            getPeerCertificate: vi.fn(() => ({})), // Empty cert object
          };
          return socket;
        });

        // #when
        const result = await probeTlsCertificate("test.example.com", 993, 1000);

        // #then
        expect(result.success).toBe(false);
        expect(result.certificateInfo).toBeUndefined();
        expect(result.errorCode).toBeDefined();
      }, 5000);

      it("should mark certificate as self-signed when error code indicates it", async () => {
        // #given - Mock self-signed cert error
        vi.mocked(tls.connect).mockImplementation((options: any, callback?: () => void) => {
          const socket = {
            on: vi.fn((event: string, handler: any) => {
              if (event === "error") {
                if (options.rejectUnauthorized === false && callback) {
                  // Unsafe socket succeeds
                  setTimeout(callback, 5);
                } else {
                  // Initial socket fails with self-signed error
                  setTimeout(() => {
                    const error = new Error("self-signed certificate") as NodeJS.ErrnoException;
                    error.code = "DEPTH_ZERO_SELF_SIGNED_CERT";
                    handler(error);
                  }, 10);
                }
              }
              return socket;
            }),
            destroy: vi.fn(),
            getPeerCertificate: vi.fn(() => ({
              fingerprint256: "12:34:56:78",
              subject: "test",
              issuer: "test",
              valid_from: "Jan  1 00:00:00 2024 GMT",
              valid_to: "Dec 31 23:59:59 2025 GMT",
            })),
          };
          return socket;
        });

        // #when
        const result = await probeTlsCertificate("test.example.com", 993, 1000);

        // #then
        expect(result.certificateInfo?.selfSigned).toBe(true);
      }, 5000);
    });
  });
});

describe("IMAP Probing Integration", () => {
  describe("probing real servers (skipped in CI)", () => {
    const skipInCI = process.env.CI ? it.skip : it;

    skipInCI("can probe Gmail IMAP", async () => {
      const result = await probeImapPort("imap.gmail.com", 993, "tls", 5000);
      expect(result.success).toBe(true);
      expect(result.capabilities).toBeDefined();
      expect(result.capabilities?.length).toBeGreaterThan(0);
    }, 10000);

    skipInCI("can get TLS certificate from Gmail", async () => {
      const result = await probeTlsCertificate("imap.gmail.com", 993, 5000);
      expect(result.success).toBe(true);
      expect(result.certificateInfo).toBeDefined();
      expect(result.certificateInfo?.selfSigned).toBe(false);
    }, 10000);
  });
});
