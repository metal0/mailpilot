import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initNotifier,
  stopNotifier,
  sendNotification,
  notifyError,
  notifyConnectionLost,
  notifyDeadLetter,
  notifyRetryExhausted,
  getNotificationHistory,
  clearNotificationHistory,
  getNotifierStatus,
} from "../../src/utils/notifier.js";
import type { NotificationConfig } from "../../src/config/schema.js";

describe("notifier", () => {
  const baseConfig: NotificationConfig = {
    enabled: true,
    channels: ["browser"],
    events: ["error", "connection_lost", "dead_letter", "retry_exhausted", "daily_summary"],
  };

  const mockBrowserNotification = vi.fn();

  beforeEach(() => {
    clearNotificationHistory();
    stopNotifier();
    mockBrowserNotification.mockClear();
  });

  afterEach(() => {
    stopNotifier();
    vi.restoreAllMocks();
  });

  describe("initNotifier", () => {
    it("initializes with enabled config", () => {
      initNotifier({
        config: baseConfig,
        onBrowserNotification: mockBrowserNotification,
      });

      const status = getNotifierStatus();
      expect(status.enabled).toBe(true);
      expect(status.config).toEqual(baseConfig);
    });

    it("handles disabled config", () => {
      initNotifier({
        config: { ...baseConfig, enabled: false },
        onBrowserNotification: mockBrowserNotification,
      });

      const status = getNotifierStatus();
      expect(status.enabled).toBe(false);
    });
  });

  describe("sendNotification", () => {
    it("sends browser notification when enabled", () => {
      initNotifier({
        config: baseConfig,
        onBrowserNotification: mockBrowserNotification,
      });

      sendNotification("error", "Test Error", "Something went wrong");

      expect(mockBrowserNotification).toHaveBeenCalledTimes(1);
      expect(mockBrowserNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "error",
          title: "Test Error",
          message: "Something went wrong",
        })
      );
    });

    it("adds notification to history", () => {
      initNotifier({
        config: baseConfig,
        onBrowserNotification: mockBrowserNotification,
      });

      sendNotification("error", "Test", "Message");

      const history = getNotificationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].title).toBe("Test");
    });

    it("respects event filter", () => {
      initNotifier({
        config: { ...baseConfig, events: ["error"] },
        onBrowserNotification: mockBrowserNotification,
      });

      sendNotification("connection_lost", "Connection Lost", "Lost connection");

      expect(mockBrowserNotification).not.toHaveBeenCalled();
    });

    it("does not send when disabled", () => {
      initNotifier({
        config: { ...baseConfig, enabled: false },
        onBrowserNotification: mockBrowserNotification,
      });

      sendNotification("error", "Test", "Message");

      expect(mockBrowserNotification).not.toHaveBeenCalled();
    });

    it("includes data in notification", () => {
      initNotifier({
        config: baseConfig,
        onBrowserNotification: mockBrowserNotification,
      });

      sendNotification("error", "Test", "Message", { accountName: "test" });

      expect(mockBrowserNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { accountName: "test" },
        })
      );
    });
  });

  describe("convenience functions", () => {
    beforeEach(() => {
      initNotifier({
        config: baseConfig,
        onBrowserNotification: mockBrowserNotification,
      });
    });

    it("notifyError sends error notification", () => {
      notifyError("TestAccount", "Connection failed");

      expect(mockBrowserNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "error",
          title: "Processing Error",
        })
      );
    });

    it("notifyConnectionLost sends connection_lost notification", () => {
      notifyConnectionLost("TestAccount");

      expect(mockBrowserNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "connection_lost",
          title: "Connection Lost",
        })
      );
    });

    it("notifyDeadLetter sends dead_letter notification", () => {
      notifyDeadLetter("TestAccount", "msg123", "Parse error");

      expect(mockBrowserNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "dead_letter",
          title: "Email Failed",
        })
      );
    });

    it("notifyRetryExhausted sends retry_exhausted notification", () => {
      notifyRetryExhausted("TestAccount", "msg123", 5);

      expect(mockBrowserNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "retry_exhausted",
          title: "Retry Exhausted",
        })
      );
    });
  });

  describe("notification history", () => {
    it("limits history to 100 entries", () => {
      initNotifier({
        config: baseConfig,
        onBrowserNotification: mockBrowserNotification,
      });

      for (let i = 0; i < 110; i++) {
        sendNotification("error", `Test ${i}`, "Message");
      }

      const history = getNotificationHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it("clearNotificationHistory clears all entries", () => {
      initNotifier({
        config: baseConfig,
        onBrowserNotification: mockBrowserNotification,
      });

      sendNotification("error", "Test", "Message");
      expect(getNotificationHistory()).toHaveLength(1);

      clearNotificationHistory();
      expect(getNotificationHistory()).toHaveLength(0);
    });
  });

  describe("quiet hours", () => {
    it("suppresses notifications during quiet hours", () => {
      const now = new Date();
      const currentHour = now.getHours();

      // Set quiet hours to include current time
      const startHour = (currentHour - 1 + 24) % 24;
      const endHour = (currentHour + 1) % 24;

      initNotifier({
        config: {
          ...baseConfig,
          quiet_hours: {
            enabled: true,
            start: `${String(startHour).padStart(2, "0")}:00`,
            end: `${String(endHour).padStart(2, "0")}:00`,
          },
        },
        onBrowserNotification: mockBrowserNotification,
      });

      sendNotification("error", "Test", "Message");

      expect(mockBrowserNotification).not.toHaveBeenCalled();
    });

    it("allows daily_summary during quiet hours", () => {
      const now = new Date();
      const currentHour = now.getHours();
      const startHour = (currentHour - 1 + 24) % 24;
      const endHour = (currentHour + 1) % 24;

      initNotifier({
        config: {
          ...baseConfig,
          quiet_hours: {
            enabled: true,
            start: `${String(startHour).padStart(2, "0")}:00`,
            end: `${String(endHour).padStart(2, "0")}:00`,
          },
        },
        onBrowserNotification: mockBrowserNotification,
      });

      sendNotification("daily_summary", "Daily Summary", "Your daily report");

      expect(mockBrowserNotification).toHaveBeenCalled();
    });
  });
});
