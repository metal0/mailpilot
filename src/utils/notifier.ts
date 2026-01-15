import { createLogger } from "./logger.js";
import type { NotificationConfig, NotificationEvent } from "../config/schema.js";

const logger = createLogger("notifier");

export interface Notification {
  id: string;
  event: NotificationEvent;
  title: string;
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface NotifierOptions {
  config: NotificationConfig;
  onBrowserNotification?: (notification: Notification) => void;
}

let notifierOptions: NotifierOptions | null = null;
let notificationHistory: Notification[] = [];
const MAX_HISTORY = 100;

export function initNotifier(options: NotifierOptions): void {
  notifierOptions = options;

  if (!options.config.enabled) {
    logger.info("Notifications disabled by configuration");
    return;
  }

  logger.info("Notifier initialized", {
    channels: options.config.channels,
    events: options.config.events,
  });
}

export function stopNotifier(): void {
  notifierOptions = null;
  logger.info("Notifier stopped");
}

function generateNotificationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function isQuietHours(): boolean {
  if (!notifierOptions?.config.quiet_hours?.enabled) {
    return false;
  }

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const start = notifierOptions.config.quiet_hours.start;
  const end = notifierOptions.config.quiet_hours.end;

  if (start <= end) {
    return currentTime >= start && currentTime < end;
  } else {
    return currentTime >= start || currentTime < end;
  }
}

function shouldNotify(event: NotificationEvent): boolean {
  if (!notifierOptions?.config.enabled) {
    return false;
  }

  if (!notifierOptions.config.events.includes(event)) {
    return false;
  }

  if (isQuietHours() && event !== "daily_summary") {
    logger.debug("Notification suppressed (quiet hours)", { event });
    return false;
  }

  return true;
}

export function sendNotification(
  event: NotificationEvent,
  title: string,
  message: string,
  data?: Record<string, unknown>
): void {
  if (!shouldNotify(event)) {
    return;
  }

  const notification: Notification = {
    id: generateNotificationId(),
    event,
    title,
    message,
    timestamp: Date.now(),
    ...(data && { data }),
  };

  notificationHistory.unshift(notification);
  if (notificationHistory.length > MAX_HISTORY) {
    notificationHistory = notificationHistory.slice(0, MAX_HISTORY);
  }

  if (!notifierOptions) {
    return;
  }

  const channels = notifierOptions.config.channels;

  if (channels.includes("browser") && notifierOptions.onBrowserNotification) {
    try {
      notifierOptions.onBrowserNotification(notification);
      logger.debug("Browser notification sent", { event, title });
    } catch (err) {
      logger.error("Failed to send browser notification", { error: err });
    }
  }
}

export function notifyError(accountName: string, error: string): void {
  sendNotification(
    "error",
    "Processing Error",
    `Error processing emails for ${accountName}: ${error}`,
    { accountName, error }
  );
}

export function notifyConnectionLost(accountName: string): void {
  sendNotification(
    "connection_lost",
    "Connection Lost",
    `Lost IMAP connection to ${accountName}`,
    { accountName }
  );
}

export function notifyDeadLetter(accountName: string, messageId: string, error: string): void {
  sendNotification(
    "dead_letter",
    "Email Failed",
    `Email processing failed for ${accountName}: ${error}`,
    { accountName, messageId, error }
  );
}

export function notifyRetryExhausted(accountName: string, messageId: string, attempts: number): void {
  sendNotification(
    "retry_exhausted",
    "Retry Exhausted",
    `Email ${messageId} in ${accountName} exhausted all ${attempts} retry attempts`,
    { accountName, messageId, attempts }
  );
}

export function notifyDailySummary(summary: {
  processed: number;
  errors: number;
  deadLetters: number;
  accountsHealthy: number;
  accountsUnhealthy: number;
}): void {
  const lines = [
    `Emails processed: ${summary.processed}`,
    `Errors: ${summary.errors}`,
    `Dead letters: ${summary.deadLetters}`,
    `Accounts healthy: ${summary.accountsHealthy}`,
    `Accounts unhealthy: ${summary.accountsUnhealthy}`,
  ];

  sendNotification(
    "daily_summary",
    "Daily Summary",
    lines.join("\n"),
    summary
  );
}

export function getNotificationHistory(): Notification[] {
  return [...notificationHistory];
}

export function clearNotificationHistory(): void {
  notificationHistory = [];
}

export function getNotifierStatus(): { enabled: boolean; config: NotificationConfig | null } {
  return {
    enabled: notifierOptions?.config.enabled ?? false,
    config: notifierOptions?.config ?? null,
  };
}
