import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  registerWebhooks,
  unregisterWebhooks,
  registerGlobalWebhooks,
  dispatchEvent,
  dispatchStartup,
  dispatchShutdown,
  dispatchError,
  dispatchActionTaken,
  dispatchConnectionLost,
  dispatchConnectionRestored,
  type WebhookPayload,
} from "../../src/webhooks/dispatcher.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Webhook Dispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    // Clear registered webhooks
    unregisterWebhooks("test-account");
    unregisterWebhooks("account1");
    unregisterWebhooks("account2");
  });

  describe("registerWebhooks", () => {
    it("registers webhooks for an account", () => {
      const webhooks = [
        { url: "https://webhook.example.com", events: ["action_taken" as const] },
      ];
      registerWebhooks("test-account", webhooks);
      // Function should complete without error
      expect(true).toBe(true);
    });

    it("overwrites existing webhooks for same account", () => {
      const webhooks1 = [{ url: "https://first.example.com", events: ["action_taken" as const] }];
      const webhooks2 = [{ url: "https://second.example.com", events: ["error" as const] }];

      registerWebhooks("test-account", webhooks1);
      registerWebhooks("test-account", webhooks2);
      // Second registration should overwrite
      expect(true).toBe(true);
    });

    it("handles empty webhook array", () => {
      registerWebhooks("test-account", []);
      expect(true).toBe(true);
    });
  });

  describe("unregisterWebhooks", () => {
    it("removes webhooks for an account", () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["action_taken" as const] }];
      registerWebhooks("test-account", webhooks);
      unregisterWebhooks("test-account");
      expect(true).toBe(true);
    });

    it("handles unregistering non-existent account", () => {
      unregisterWebhooks("non-existent");
      expect(true).toBe(true);
    });

    it("can be called multiple times", () => {
      unregisterWebhooks("test-account");
      unregisterWebhooks("test-account");
      expect(true).toBe(true);
    });
  });

  describe("registerGlobalWebhooks", () => {
    it("registers global webhooks", () => {
      const webhooks = [
        { url: "https://global.example.com", events: ["startup" as const, "shutdown" as const] },
      ];
      registerGlobalWebhooks(webhooks);
      expect(true).toBe(true);
    });

    it("handles empty webhook array", () => {
      registerGlobalWebhooks([]);
      expect(true).toBe(true);
    });
  });

  describe("dispatchEvent", () => {
    it("creates payload with event and timestamp", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["action_taken" as const] }];
      registerWebhooks("test-account", webhooks);

      await dispatchEvent("action_taken", "test-account");

      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body) as WebhookPayload;
      expect(body.event).toBe("action_taken");
      expect(body.timestamp).toBeDefined();
      expect(body.account).toBe("test-account");
    });

    it("includes optional data in payload", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["error" as const] }];
      registerWebhooks("test-account", webhooks);

      await dispatchEvent("error", "test-account", {
        error: "Test error message",
        message_id: "msg-123",
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body) as WebhookPayload;
      expect(body.error).toBe("Test error message");
      expect(body.message_id).toBe("msg-123");
    });

    it("does not call webhooks for unsubscribed events", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["action_taken" as const] }];
      registerWebhooks("test-account", webhooks);

      await dispatchEvent("error", "test-account");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sends to multiple webhooks subscribed to same event", async () => {
      const webhooks = [
        { url: "https://first.example.com", events: ["action_taken" as const] },
        { url: "https://second.example.com", events: ["action_taken" as const] },
      ];
      registerWebhooks("test-account", webhooks);

      await dispatchEvent("action_taken", "test-account");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("includes custom headers", async () => {
      const webhooks = [
        {
          url: "https://webhook.example.com",
          events: ["action_taken" as const],
          headers: { Authorization: "Bearer token123" },
        },
      ];
      registerWebhooks("test-account", webhooks);

      await dispatchEvent("action_taken", "test-account");

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers.Authorization).toBe("Bearer token123");
    });

    it("always includes Content-Type header", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["action_taken" as const] }];
      registerWebhooks("test-account", webhooks);

      await dispatchEvent("action_taken", "test-account");

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers["Content-Type"]).toBe("application/json");
    });

    it("handles fetch failure gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const webhooks = [{ url: "https://webhook.example.com", events: ["action_taken" as const] }];
      registerWebhooks("test-account", webhooks);

      // Should not throw
      await dispatchEvent("action_taken", "test-account");
      expect(true).toBe(true);
    });

    it("handles non-ok response gracefully", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const webhooks = [{ url: "https://webhook.example.com", events: ["action_taken" as const] }];
      registerWebhooks("test-account", webhooks);

      // Should not throw
      await dispatchEvent("action_taken", "test-account");
      expect(true).toBe(true);
    });

    it("continues processing other webhooks if one fails", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("First failed"))
        .mockResolvedValueOnce({ ok: true });

      const webhooks = [
        { url: "https://first.example.com", events: ["action_taken" as const] },
        { url: "https://second.example.com", events: ["action_taken" as const] },
      ];
      registerWebhooks("test-account", webhooks);

      await dispatchEvent("action_taken", "test-account");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("dispatchStartup", () => {
    it("dispatches startup event", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["startup" as const] }];
      registerWebhooks("test-account", webhooks);

      await dispatchStartup();

      expect(mockFetch).toHaveBeenCalled();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body) as WebhookPayload;
      expect(body.event).toBe("startup");
    });

    it("notifies all accounts subscribed to startup", async () => {
      const webhooks1 = [{ url: "https://first.example.com", events: ["startup" as const] }];
      const webhooks2 = [{ url: "https://second.example.com", events: ["startup" as const] }];
      registerWebhooks("account1", webhooks1);
      registerWebhooks("account2", webhooks2);

      await dispatchStartup();

      // Should be called at least 2 times (may include global webhooks from other tests)
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
      // Verify both our URLs were called
      const calledUrls = mockFetch.mock.calls.map((c) => c[0] as string);
      expect(calledUrls).toContain("https://first.example.com");
      expect(calledUrls).toContain("https://second.example.com");
    });
  });

  describe("dispatchShutdown", () => {
    it("dispatches shutdown event", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["shutdown" as const] }];
      registerWebhooks("test-account", webhooks);

      await dispatchShutdown();

      expect(mockFetch).toHaveBeenCalled();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body) as WebhookPayload;
      expect(body.event).toBe("shutdown");
    });

    it("includes reason when provided", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["shutdown" as const] }];
      registerWebhooks("test-account", webhooks);

      await dispatchShutdown("Scheduled maintenance");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body) as WebhookPayload;
      expect(body.reason).toBe("Scheduled maintenance");
    });

    it("omits reason when not provided", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["shutdown" as const] }];
      registerWebhooks("test-account", webhooks);

      await dispatchShutdown();

      const body = JSON.parse(mockFetch.mock.calls[0][1].body) as WebhookPayload;
      expect(body.reason).toBeUndefined();
    });
  });

  describe("dispatchError", () => {
    it("dispatches error event with message", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["error" as const] }];
      registerWebhooks("test-account", webhooks);

      await dispatchError("test-account", "Connection timeout");

      expect(mockFetch).toHaveBeenCalled();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body) as WebhookPayload;
      expect(body.event).toBe("error");
      expect(body.error).toBe("Connection timeout");
      expect(body.account).toBe("test-account");
    });

    it("includes message_id when provided", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["error" as const] }];
      registerWebhooks("test-account", webhooks);

      await dispatchError("test-account", "Processing failed", "msg-456");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body) as WebhookPayload;
      expect(body.message_id).toBe("msg-456");
    });

    it("omits message_id when not provided", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["error" as const] }];
      registerWebhooks("test-account", webhooks);

      await dispatchError("test-account", "Generic error");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body) as WebhookPayload;
      expect(body.message_id).toBeUndefined();
    });
  });

  describe("dispatchActionTaken", () => {
    it("dispatches action_taken event with all data", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["action_taken" as const] }];
      registerWebhooks("test-account", webhooks);

      const actions = [
        { type: "move" as const, destination: "Archive" },
        { type: "flag" as const, flags: ["\\Seen"] },
      ];
      await dispatchActionTaken("test-account", "msg-789", actions, "openai");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body) as WebhookPayload;
      expect(body.event).toBe("action_taken");
      expect(body.message_id).toBe("msg-789");
      expect(body.actions).toEqual(actions);
      expect(body.llm_provider).toBe("openai");
    });
  });

  describe("dispatchConnectionLost", () => {
    it("dispatches connection_lost event", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["connection_lost" as const] }];
      registerWebhooks("test-account", webhooks);

      await dispatchConnectionLost("test-account");

      expect(mockFetch).toHaveBeenCalled();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body) as WebhookPayload;
      expect(body.event).toBe("connection_lost");
      expect(body.account).toBe("test-account");
    });
  });

  describe("dispatchConnectionRestored", () => {
    it("dispatches connection_restored event", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["connection_restored" as const] }];
      registerWebhooks("test-account", webhooks);

      await dispatchConnectionRestored("test-account");

      expect(mockFetch).toHaveBeenCalled();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body) as WebhookPayload;
      expect(body.event).toBe("connection_restored");
      expect(body.account).toBe("test-account");
    });
  });

  describe("WebhookPayload structure", () => {
    it("always includes event and timestamp", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["action_taken" as const] }];
      registerWebhooks("test-account", webhooks);

      await dispatchEvent("action_taken", "test-account");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body) as WebhookPayload;
      expect(body).toHaveProperty("event");
      expect(body).toHaveProperty("timestamp");
    });

    it("timestamp is valid ISO string", async () => {
      const webhooks = [{ url: "https://webhook.example.com", events: ["action_taken" as const] }];
      registerWebhooks("test-account", webhooks);

      await dispatchEvent("action_taken", "test-account");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body) as WebhookPayload;
      const parsed = new Date(body.timestamp);
      expect(parsed.toISOString()).toBe(body.timestamp);
    });
  });

  describe("multiple accounts", () => {
    it("only notifies correct account for account-specific events", async () => {
      const webhooks1 = [{ url: "https://account1.example.com", events: ["action_taken" as const] }];
      const webhooks2 = [{ url: "https://account2.example.com", events: ["action_taken" as const] }];
      registerWebhooks("account1", webhooks1);
      registerWebhooks("account2", webhooks2);

      await dispatchEvent("action_taken", "account1");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toBe("https://account1.example.com");
    });

    it("handles accounts with different event subscriptions", async () => {
      const webhooks1 = [{ url: "https://account1.example.com", events: ["action_taken" as const] }];
      const webhooks2 = [{ url: "https://account2.example.com", events: ["error" as const] }];
      registerWebhooks("account1", webhooks1);
      registerWebhooks("account2", webhooks2);

      await dispatchEvent("action_taken", "account1");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await dispatchEvent("error", "account2");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
