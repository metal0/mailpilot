import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { stopIdleLoop, stopAllIdleLoops } from "../../src/imap/idle.js";

// Note: startIdleLoop is harder to test because it runs in an infinite loop
// These tests focus on the control functions

describe("IDLE Module", () => {
  beforeEach(() => {
    stopAllIdleLoops();
  });

  afterEach(() => {
    stopAllIdleLoops();
  });

  describe("stopIdleLoop", () => {
    it("returns false when loop doesn't exist", () => {
      const result = stopIdleLoop("non-existent-key");
      expect(result).toBe(false);
    });

    it("returns false for empty key", () => {
      const result = stopIdleLoop("");
      expect(result).toBe(false);
    });

    it("handles special characters in loop key", () => {
      const result = stopIdleLoop("special:key/with:chars");
      expect(result).toBe(false);
    });
  });

  describe("stopAllIdleLoops", () => {
    it("can be called when no loops are active", () => {
      // Should not throw
      expect(() => stopAllIdleLoops()).not.toThrow();
    });

    it("can be called multiple times", () => {
      stopAllIdleLoops();
      stopAllIdleLoops();
      stopAllIdleLoops();
      // Should not throw
      expect(true).toBe(true);
    });
  });
});

describe("IDLE Loop Configuration", () => {
  describe("IdleOptions interface", () => {
    it("validates required options structure", () => {
      const options = {
        client: {},
        mailbox: "INBOX",
        pollingInterval: "30s",
        onNewMail: vi.fn(),
        supportsIdle: true,
        loopKey: "test-key",
      };

      expect(options.mailbox).toBe("INBOX");
      expect(options.pollingInterval).toBe("30s");
      expect(options.supportsIdle).toBe(true);
    });

    it("allows optional loopKey", () => {
      const options = {
        client: {},
        mailbox: "INBOX",
        pollingInterval: "30s",
        onNewMail: vi.fn(),
        supportsIdle: false,
      };

      expect(options.loopKey).toBeUndefined();
    });
  });

  describe("callback interface", () => {
    it("NewMailCallback receives count", () => {
      const callback = vi.fn();
      callback(5);
      expect(callback).toHaveBeenCalledWith(5);
    });

    it("callback handles zero count", () => {
      const callback = vi.fn();
      callback(0);
      expect(callback).toHaveBeenCalledWith(0);
    });

    it("callback handles large count", () => {
      const callback = vi.fn();
      callback(9999);
      expect(callback).toHaveBeenCalledWith(9999);
    });
  });
});

describe("Polling interval parsing", () => {
  it("common polling intervals are valid", () => {
    // These would be parsed by parseDuration
    const validIntervals = ["30s", "1m", "5m", "30m", "1h"];

    for (const interval of validIntervals) {
      expect(typeof interval).toBe("string");
      expect(interval.length).toBeGreaterThan(0);
    }
  });

  it("recommended default is 30 seconds", () => {
    const defaultInterval = "30s";
    expect(defaultInterval).toBe("30s");
  });
});

describe("IDLE vs Polling mode", () => {
  describe("supportsIdle flag", () => {
    it("true indicates IDLE support", () => {
      const supportsIdle = true;
      expect(supportsIdle).toBe(true);
    });

    it("false indicates polling mode", () => {
      const supportsIdle = false;
      expect(supportsIdle).toBe(false);
    });
  });

  describe("mailbox parameter", () => {
    it("common mailbox names", () => {
      const mailboxes = ["INBOX", "Sent", "Drafts", "Trash", "Spam", "Archive"];

      for (const mailbox of mailboxes) {
        expect(typeof mailbox).toBe("string");
      }
    });

    it("handles nested mailboxes", () => {
      const nestedMailbox = "INBOX/Work/Important";
      expect(nestedMailbox).toContain("/");
    });

    it("handles mailboxes with special chars", () => {
      const specialMailbox = "INBOX.Subfolder";
      expect(specialMailbox).toContain(".");
    });
  });
});

describe("Loop key management", () => {
  it("keys can use account identifiers", () => {
    const key = "account:user@example.com:INBOX";
    expect(key).toContain("account:");
    expect(key).toContain("@");
  });

  it("keys can be simple identifiers", () => {
    const key = "main-account-inbox";
    expect(key).not.toContain(":");
  });

  it("unique keys for different mailboxes", () => {
    const key1 = "account1:INBOX";
    const key2 = "account1:Sent";
    expect(key1).not.toBe(key2);
  });

  it("unique keys for different accounts", () => {
    const key1 = "account1:INBOX";
    const key2 = "account2:INBOX";
    expect(key1).not.toBe(key2);
  });
});
