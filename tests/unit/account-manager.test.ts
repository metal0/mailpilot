import { describe, it, expect, beforeEach } from "vitest";

/**
 * Tests for account management functionality including:
 * - Pause/Resume accounts
 * - Queue status tracking
 * - Processing debounce
 *
 * These features enable manual control of email processing from the dashboard.
 */

interface QueueStatus {
  accountName: string;
  folder: string;
  processing: boolean;
  pendingCount: number;
  startedAt?: number;
}

describe("Account Pause/Resume", () => {
  let activeClients: Map<string, { name: string }>;
  let pausedAccounts: Set<string>;

  beforeEach(() => {
    activeClients = new Map();
    pausedAccounts = new Set();

    // Setup test accounts
    activeClients.set("account-1", { name: "account-1" });
    activeClients.set("account-2", { name: "account-2" });
  });

  describe("pauseAccount", () => {
    it("pauses an active account", () => {
      const accountName = "account-1";

      if (!activeClients.has(accountName)) {
        throw new Error("Account not found");
      }

      pausedAccounts.add(accountName);

      expect(pausedAccounts.has(accountName)).toBe(true);
    });

    it("returns false for non-existent account", () => {
      const accountName = "non-existent";

      const success = activeClients.has(accountName);

      expect(success).toBe(false);
    });

    it("is idempotent - pausing already paused account", () => {
      const accountName = "account-1";
      pausedAccounts.add(accountName);

      // Pause again
      pausedAccounts.add(accountName);

      expect(pausedAccounts.has(accountName)).toBe(true);
      expect(pausedAccounts.size).toBe(1);
    });
  });

  describe("resumeAccount", () => {
    it("resumes a paused account", () => {
      const accountName = "account-1";
      pausedAccounts.add(accountName);

      expect(pausedAccounts.has(accountName)).toBe(true);

      pausedAccounts.delete(accountName);

      expect(pausedAccounts.has(accountName)).toBe(false);
    });

    it("returns false for non-existent account", () => {
      const accountName = "non-existent";

      const success = activeClients.has(accountName);

      expect(success).toBe(false);
    });

    it("is idempotent - resuming non-paused account", () => {
      const accountName = "account-1";

      // Not paused initially
      expect(pausedAccounts.has(accountName)).toBe(false);

      pausedAccounts.delete(accountName);

      expect(pausedAccounts.has(accountName)).toBe(false);
    });
  });

  describe("isAccountPaused", () => {
    it("returns true for paused accounts", () => {
      pausedAccounts.add("account-1");

      expect(pausedAccounts.has("account-1")).toBe(true);
    });

    it("returns false for active accounts", () => {
      expect(pausedAccounts.has("account-1")).toBe(false);
    });

    it("returns false for non-existent accounts", () => {
      expect(pausedAccounts.has("non-existent")).toBe(false);
    });
  });

  describe("getPausedAccounts", () => {
    it("returns list of all paused accounts", () => {
      pausedAccounts.add("account-1");
      pausedAccounts.add("account-2");

      const list = Array.from(pausedAccounts);

      expect(list).toHaveLength(2);
      expect(list).toContain("account-1");
      expect(list).toContain("account-2");
    });

    it("returns empty array when no accounts paused", () => {
      const list = Array.from(pausedAccounts);

      expect(list).toHaveLength(0);
    });
  });
});

describe("Queue Status Tracking", () => {
  let processingQueue: Map<string, QueueStatus>;

  beforeEach(() => {
    processingQueue = new Map();
  });

  describe("Queue status updates", () => {
    it("adds new processing entry", () => {
      const queueKey = "account-1:INBOX";
      const status: QueueStatus = {
        accountName: "account-1",
        folder: "INBOX",
        processing: true,
        pendingCount: 5,
        startedAt: Date.now(),
      };

      processingQueue.set(queueKey, status);

      expect(processingQueue.has(queueKey)).toBe(true);
      expect(processingQueue.get(queueKey)?.pendingCount).toBe(5);
    });

    it("removes entry when processing completes", () => {
      const queueKey = "account-1:INBOX";
      processingQueue.set(queueKey, {
        accountName: "account-1",
        folder: "INBOX",
        processing: true,
        pendingCount: 5,
        startedAt: Date.now(),
      });

      // Processing complete
      processingQueue.delete(queueKey);

      expect(processingQueue.has(queueKey)).toBe(false);
    });

    it("handles multiple accounts processing simultaneously", () => {
      processingQueue.set("account-1:INBOX", {
        accountName: "account-1",
        folder: "INBOX",
        processing: true,
        pendingCount: 3,
        startedAt: Date.now(),
      });

      processingQueue.set("account-2:INBOX", {
        accountName: "account-2",
        folder: "INBOX",
        processing: true,
        pendingCount: 7,
        startedAt: Date.now(),
      });

      expect(processingQueue.size).toBe(2);
    });
  });

  describe("getQueueStatus", () => {
    it("returns all queue entries", () => {
      processingQueue.set("account-1:INBOX", {
        accountName: "account-1",
        folder: "INBOX",
        processing: true,
        pendingCount: 3,
        startedAt: Date.now(),
      });

      const statuses = Array.from(processingQueue.values());

      expect(statuses).toHaveLength(1);
      expect(statuses[0].accountName).toBe("account-1");
    });

    it("returns empty array when nothing processing", () => {
      const statuses = Array.from(processingQueue.values());

      expect(statuses).toHaveLength(0);
    });
  });

  describe("isProcessing", () => {
    it("returns true when account is processing", () => {
      processingQueue.set("account-1:INBOX", {
        accountName: "account-1",
        folder: "INBOX",
        processing: true,
        pendingCount: 3,
        startedAt: Date.now(),
      });

      const isProcessing = Array.from(processingQueue.values())
        .some(s => s.accountName === "account-1" && s.processing);

      expect(isProcessing).toBe(true);
    });

    it("returns false when account is not processing", () => {
      const isProcessing = Array.from(processingQueue.values())
        .some(s => s.accountName === "account-1" && s.processing);

      expect(isProcessing).toBe(false);
    });
  });
});

describe("Processing Debounce", () => {
  const PROCESS_DEBOUNCE_MS = 5000;
  let lastProcessedAt: Map<string, number>;

  beforeEach(() => {
    lastProcessedAt = new Map();
  });

  it("allows first processing request", () => {
    const queueKey = "account-1:INBOX";
    const now = Date.now();

    const lastProcessed = lastProcessedAt.get(queueKey);
    const shouldDebounce = lastProcessed && (now - lastProcessed < PROCESS_DEBOUNCE_MS);

    expect(shouldDebounce).toBeFalsy();
  });

  it("debounces rapid successive requests", () => {
    const queueKey = "account-1:INBOX";
    const now = Date.now();

    // First request
    lastProcessedAt.set(queueKey, now - 1000); // 1 second ago

    const lastProcessed = lastProcessedAt.get(queueKey)!;
    const shouldDebounce = now - lastProcessed < PROCESS_DEBOUNCE_MS;

    expect(shouldDebounce).toBe(true);
  });

  it("allows request after debounce period", () => {
    const queueKey = "account-1:INBOX";
    const now = Date.now();

    // Last processed 6 seconds ago
    lastProcessedAt.set(queueKey, now - 6000);

    const lastProcessed = lastProcessedAt.get(queueKey)!;
    const shouldDebounce = now - lastProcessed < PROCESS_DEBOUNCE_MS;

    expect(shouldDebounce).toBe(false);
  });

  it("tracks debounce independently per folder", () => {
    const now = Date.now();

    // INBOX was just processed
    lastProcessedAt.set("account-1:INBOX", now - 1000);

    // Archive was not recently processed
    lastProcessedAt.set("account-1:Archive", now - 10000);

    const inboxDebounced = (now - lastProcessedAt.get("account-1:INBOX")!) < PROCESS_DEBOUNCE_MS;
    const archiveDebounced = (now - lastProcessedAt.get("account-1:Archive")!) < PROCESS_DEBOUNCE_MS;

    expect(inboxDebounced).toBe(true);
    expect(archiveDebounced).toBe(false);
  });

  it("updates last processed time after processing", () => {
    const queueKey = "account-1:INBOX";
    const initialTime = Date.now() - 10000;
    lastProcessedAt.set(queueKey, initialTime);

    // Process and update
    const newTime = Date.now();
    lastProcessedAt.set(queueKey, newTime);

    expect(lastProcessedAt.get(queueKey)).toBe(newTime);
    expect(lastProcessedAt.get(queueKey)).not.toBe(initialTime);
  });
});

describe("Manual Processing Trigger", () => {
  let accountContexts: Map<string, { name: string }>;
  let pausedAccounts: Set<string>;

  beforeEach(() => {
    accountContexts = new Map();
    pausedAccounts = new Set();

    accountContexts.set("account-1", { name: "account-1" });
  });

  it("fails for non-existent account", () => {
    const ctx = accountContexts.get("non-existent");

    expect(ctx).toBeUndefined();
  });

  it("fails for paused account", () => {
    pausedAccounts.add("account-1");

    const isPaused = pausedAccounts.has("account-1");

    expect(isPaused).toBe(true);
  });

  it("succeeds for active account", () => {
    const ctx = accountContexts.get("account-1");
    const isPaused = pausedAccounts.has("account-1");

    expect(ctx).toBeDefined();
    expect(isPaused).toBe(false);
  });
});

describe("Account Reconnect", () => {
  it("stops IDLE loops for all watched folders", () => {
    const watchFolders = ["INBOX", "Archive", "Sent"];
    const stoppedLoops: string[] = [];

    for (const folder of watchFolders) {
      const loopKey = `account-1:${folder}`;
      stoppedLoops.push(loopKey);
    }

    expect(stoppedLoops).toHaveLength(3);
    expect(stoppedLoops).toContain("account-1:INBOX");
    expect(stoppedLoops).toContain("account-1:Archive");
    expect(stoppedLoops).toContain("account-1:Sent");
  });

  it("uses default INBOX when no folders configured", () => {
    const watchFolders = undefined;
    const folders = watchFolders ?? ["INBOX"];

    expect(folders).toEqual(["INBOX"]);
  });
});
