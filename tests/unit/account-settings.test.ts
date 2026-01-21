import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  savePausedStatus,
  getPausedStatus,
  getAllPausedAccounts,
  deleteAccountSettings,
} from "../../src/storage/account-settings.js";
import { initDatabase, closeDatabase } from "../../src/storage/database.js";

describe("Account Settings Storage", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mailpilot-test-"));
    dbPath = join(tempDir, "test.db");
    initDatabase(dbPath);
  });

  afterEach(() => {
    closeDatabase();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("savePausedStatus", () => {
    it("saves paused status for a new account", () => {
      savePausedStatus("test-account", true);
      expect(getPausedStatus("test-account")).toBe(true);
    });

    it("updates paused status for existing account", () => {
      savePausedStatus("test-account", true);
      expect(getPausedStatus("test-account")).toBe(true);

      savePausedStatus("test-account", false);
      expect(getPausedStatus("test-account")).toBe(false);
    });

    it("handles multiple accounts independently", () => {
      savePausedStatus("account-1", true);
      savePausedStatus("account-2", false);
      savePausedStatus("account-3", true);

      expect(getPausedStatus("account-1")).toBe(true);
      expect(getPausedStatus("account-2")).toBe(false);
      expect(getPausedStatus("account-3")).toBe(true);
    });
  });

  describe("getPausedStatus", () => {
    it("returns false for unknown account", () => {
      expect(getPausedStatus("nonexistent")).toBe(false);
    });

    it("returns true for paused account", () => {
      savePausedStatus("paused-account", true);
      expect(getPausedStatus("paused-account")).toBe(true);
    });

    it("returns false for unpaused account", () => {
      savePausedStatus("active-account", false);
      expect(getPausedStatus("active-account")).toBe(false);
    });
  });

  describe("getAllPausedAccounts", () => {
    it("returns empty array when no accounts are paused", () => {
      expect(getAllPausedAccounts()).toEqual([]);
    });

    it("returns empty array when all accounts are unpaused", () => {
      savePausedStatus("account-1", false);
      savePausedStatus("account-2", false);
      expect(getAllPausedAccounts()).toEqual([]);
    });

    it("returns only paused accounts", () => {
      savePausedStatus("paused-1", true);
      savePausedStatus("active-1", false);
      savePausedStatus("paused-2", true);
      savePausedStatus("active-2", false);

      const paused = getAllPausedAccounts();
      expect(paused).toHaveLength(2);
      expect(paused).toContain("paused-1");
      expect(paused).toContain("paused-2");
      expect(paused).not.toContain("active-1");
      expect(paused).not.toContain("active-2");
    });

    it("reflects status updates", () => {
      savePausedStatus("account-1", true);
      expect(getAllPausedAccounts()).toContain("account-1");

      savePausedStatus("account-1", false);
      expect(getAllPausedAccounts()).not.toContain("account-1");
    });
  });

  describe("deleteAccountSettings", () => {
    it("removes account settings", () => {
      savePausedStatus("to-delete", true);
      expect(getPausedStatus("to-delete")).toBe(true);

      deleteAccountSettings("to-delete");
      expect(getPausedStatus("to-delete")).toBe(false);
    });

    it("removes account from paused list", () => {
      savePausedStatus("to-delete", true);
      expect(getAllPausedAccounts()).toContain("to-delete");

      deleteAccountSettings("to-delete");
      expect(getAllPausedAccounts()).not.toContain("to-delete");
    });

    it("handles deleting nonexistent account gracefully", () => {
      expect(() => deleteAccountSettings("nonexistent")).not.toThrow();
    });
  });

  describe("persistence across sessions", () => {
    it("maintains paused status after database reconnect", () => {
      savePausedStatus("persistent-account", true);
      closeDatabase();

      initDatabase(dbPath);
      expect(getPausedStatus("persistent-account")).toBe(true);
    });

    it("maintains all paused accounts after database reconnect", () => {
      savePausedStatus("account-1", true);
      savePausedStatus("account-2", true);
      savePausedStatus("account-3", false);
      closeDatabase();

      initDatabase(dbPath);
      const paused = getAllPausedAccounts();
      expect(paused).toHaveLength(2);
      expect(paused).toContain("account-1");
      expect(paused).toContain("account-2");
    });
  });
});
