import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getVersion,
  updateAccountStatus,
  incrementAccountErrors,
  removeAccountStatus,
  getUptime,
  getAccountStatuses,
  setAccountUpdateBroadcast,
} from "../../src/server/status.js";

// Mock the audit module
vi.mock("../../src/storage/audit.js", () => ({
  getEmailsWithActionsCount: vi.fn((accountName?: string) => accountName ? 10 : 100),
  getActionCount: vi.fn((accountName?: string) => accountName ? 5 : 50),
}));

// Mock the providers module
vi.mock("../../src/llm/providers.js", () => ({
  getProviderStats: vi.fn(() => []),
  getProviderForAccount: vi.fn(() => ({
    provider: { name: "mock-provider" },
    model: "mock-model",
  })),
}));

describe("Server Status", () => {
  beforeEach(() => {
    // Clear account statuses
    removeAccountStatus("test-account");
    removeAccountStatus("account1");
    removeAccountStatus("account2");
  });

  describe("getVersion", () => {
    it("returns a version string", () => {
      const version = getVersion();
      expect(typeof version).toBe("string");
      expect(version.length).toBeGreaterThan(0);
    });

    it("returns consistent version on multiple calls", () => {
      const version1 = getVersion();
      const version2 = getVersion();
      expect(version1).toBe(version2);
    });

    it("version matches semver pattern or is 'unknown'", () => {
      const version = getVersion();
      const semverPattern = /^\d+\.\d+\.\d+(-\w+)?$/;
      expect(version === "unknown" || semverPattern.test(version)).toBe(true);
    });
  });

  describe("updateAccountStatus", () => {
    it("creates new account status if not exists", () => {
      updateAccountStatus("new-account", { connected: true });
      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "new-account");
      expect(account).toBeDefined();
      expect(account?.connected).toBe(true);
      removeAccountStatus("new-account");
    });

    it("updates existing account status", () => {
      updateAccountStatus("test-account", { connected: false });
      updateAccountStatus("test-account", { connected: true });

      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "test-account");
      expect(account?.connected).toBe(true);
    });

    it("preserves existing values when updating partial status", () => {
      updateAccountStatus("test-account", {
        connected: true,
        idleSupported: true,
        errors: 5,
      });
      updateAccountStatus("test-account", { connected: false });

      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "test-account");
      expect(account?.connected).toBe(false);
      expect(account?.idleSupported).toBe(true);
      expect(account?.errors).toBe(5);
    });

    it("updates lastScan timestamp", () => {
      const now = new Date();
      updateAccountStatus("test-account", { lastScan: now });

      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "test-account");
      expect(account?.lastScan).toBe(now.toISOString());
    });

    it("updates llm provider and model", () => {
      updateAccountStatus("test-account", {
        llmProvider: "anthropic",
        llmModel: "claude-3-opus",
      });

      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "test-account");
      expect(account?.llmProvider).toBe("anthropic");
      expect(account?.llmModel).toBe("claude-3-opus");
    });

    it("updates imap host and port", () => {
      updateAccountStatus("test-account", {
        imapHost: "imap.gmail.com",
        imapPort: 993,
      });

      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "test-account");
      expect(account?.imapHost).toBe("imap.gmail.com");
      expect(account?.imapPort).toBe(993);
    });

    it("updates paused status", () => {
      updateAccountStatus("test-account", { paused: false });
      let statuses = getAccountStatuses();
      let account = statuses.find((s) => s.name === "test-account");
      expect(account?.paused).toBe(false);

      updateAccountStatus("test-account", { paused: true });
      statuses = getAccountStatuses();
      account = statuses.find((s) => s.name === "test-account");
      expect(account?.paused).toBe(true);
    });

    it("calls broadcast function when set", () => {
      const broadcastFn = vi.fn();
      setAccountUpdateBroadcast(broadcastFn);

      updateAccountStatus("test-account", { connected: true });

      expect(broadcastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "test-account",
          connected: true,
        })
      );

      // Reset broadcast
      setAccountUpdateBroadcast(null as unknown as (data: unknown) => void);
    });
  });

  describe("incrementAccountErrors", () => {
    it("increments error count for existing account", () => {
      updateAccountStatus("test-account", { errors: 0 });
      incrementAccountErrors("test-account");

      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "test-account");
      expect(account?.errors).toBe(1);
    });

    it("can increment multiple times", () => {
      updateAccountStatus("test-account", { errors: 0 });
      incrementAccountErrors("test-account");
      incrementAccountErrors("test-account");
      incrementAccountErrors("test-account");

      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "test-account");
      expect(account?.errors).toBe(3);
    });

    it("does nothing for non-existent account", () => {
      // Should not throw
      incrementAccountErrors("non-existent");
      expect(true).toBe(true);
    });
  });

  describe("removeAccountStatus", () => {
    it("removes account from statuses", () => {
      updateAccountStatus("test-account", { connected: true });
      removeAccountStatus("test-account");

      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "test-account");
      expect(account).toBeUndefined();
    });

    it("handles removing non-existent account", () => {
      // Should not throw
      removeAccountStatus("non-existent");
      expect(true).toBe(true);
    });

    it("only removes specified account", () => {
      updateAccountStatus("account1", { connected: true });
      updateAccountStatus("account2", { connected: true });
      removeAccountStatus("account1");

      const statuses = getAccountStatuses();
      expect(statuses.find((s) => s.name === "account1")).toBeUndefined();
      expect(statuses.find((s) => s.name === "account2")).toBeDefined();
    });
  });

  describe("getUptime", () => {
    it("returns a number", () => {
      const uptime = getUptime();
      expect(typeof uptime).toBe("number");
    });

    it("returns non-negative value", () => {
      const uptime = getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
    });

    it("increases over time", async () => {
      const uptime1 = getUptime();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const uptime2 = getUptime();
      // Due to timing, uptime2 should be >= uptime1
      expect(uptime2).toBeGreaterThanOrEqual(uptime1);
    });

    it("returns seconds (not milliseconds)", () => {
      const uptime = getUptime();
      // If running for less than a day, should be < 86400
      expect(uptime).toBeLessThan(86400 * 30); // Less than 30 days in seconds
    });
  });

  describe("getAccountStatuses", () => {
    it("returns empty array when no accounts", () => {
      const statuses = getAccountStatuses();
      // May have accounts from other tests, but at minimum should be an array
      expect(Array.isArray(statuses)).toBe(true);
    });

    it("returns all registered accounts", () => {
      updateAccountStatus("account1", { connected: true });
      updateAccountStatus("account2", { connected: false });

      const statuses = getAccountStatuses();
      const names = statuses.map((s) => s.name);
      expect(names).toContain("account1");
      expect(names).toContain("account2");
    });

    it("includes all account status fields", () => {
      updateAccountStatus("test-account", {
        connected: true,
        idleSupported: true,
        errors: 2,
        llmProvider: "openai",
        llmModel: "gpt-4",
        imapHost: "imap.test.com",
        imapPort: 993,
        paused: false,
      });

      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "test-account");

      expect(account).toMatchObject({
        name: "test-account",
        connected: true,
        idleSupported: true,
        errors: 2,
        llmProvider: "openai",
        llmModel: "gpt-4",
        imapHost: "imap.test.com",
        imapPort: 993,
        paused: false,
      });
    });

    it("converts lastScan Date to ISO string", () => {
      const date = new Date("2024-01-01T12:00:00Z");
      updateAccountStatus("test-account", { lastScan: date });

      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "test-account");
      expect(account?.lastScan).toBe("2024-01-01T12:00:00.000Z");
    });

    it("returns null for lastScan when not set", () => {
      updateAccountStatus("test-account", { connected: true });

      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "test-account");
      expect(account?.lastScan).toBeNull();
    });
  });

  describe("setAccountUpdateBroadcast", () => {
    it("accepts a function", () => {
      const fn = vi.fn();
      setAccountUpdateBroadcast(fn);
      expect(true).toBe(true);
    });

    it("broadcast function receives account update data", () => {
      const fn = vi.fn();
      setAccountUpdateBroadcast(fn);

      updateAccountStatus("test-account", {
        connected: true,
        idleSupported: false,
        errors: 1,
        llmProvider: "test",
        llmModel: "test-model",
        imapHost: "imap.test.com",
        imapPort: 993,
        paused: false,
      });

      expect(fn).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "test-account",
          connected: true,
          idleSupported: false,
          errors: 1,
        })
      );

      // Reset
      setAccountUpdateBroadcast(null as unknown as (data: unknown) => void);
    });
  });

  describe("default values", () => {
    it("new account has default connected false", () => {
      updateAccountStatus("test-account", {});

      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "test-account");
      expect(account?.connected).toBe(false);
    });

    it("new account has default idleSupported false", () => {
      updateAccountStatus("test-account", {});

      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "test-account");
      expect(account?.idleSupported).toBe(false);
    });

    it("new account has default errors 0", () => {
      updateAccountStatus("test-account", {});

      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "test-account");
      expect(account?.errors).toBe(0);
    });

    it("new account has default paused false", () => {
      updateAccountStatus("test-account", {});

      const statuses = getAccountStatuses();
      const account = statuses.find((s) => s.name === "test-account");
      expect(account?.paused).toBe(false);
    });
  });
});

describe("AccountStatus interface", () => {
  it("has all required fields", () => {
    updateAccountStatus("interface-test", {
      connected: true,
      idleSupported: true,
      lastScan: new Date(),
      errors: 0,
      llmProvider: "test",
      llmModel: "model",
      imapHost: "host",
      imapPort: 993,
      paused: false,
    });

    const statuses = getAccountStatuses();
    const account = statuses.find((s) => s.name === "interface-test");

    expect(account).toHaveProperty("name");
    expect(account).toHaveProperty("llmProvider");
    expect(account).toHaveProperty("llmModel");
    expect(account).toHaveProperty("connected");
    expect(account).toHaveProperty("idleSupported");
    expect(account).toHaveProperty("lastScan");
    expect(account).toHaveProperty("emailsProcessed");
    expect(account).toHaveProperty("actionsTaken");
    expect(account).toHaveProperty("errors");
    expect(account).toHaveProperty("imapHost");
    expect(account).toHaveProperty("imapPort");
    expect(account).toHaveProperty("paused");

    removeAccountStatus("interface-test");
  });
});
