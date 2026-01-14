import type { ImapFlow } from "imapflow";
import { createLogger } from "../utils/logger.js";
import { parseDuration } from "../utils/duration.js";
import { isShutdownInProgress } from "../utils/shutdown.js";

const logger = createLogger("imap-idle");

export type NewMailCallback = (count: number) => void;

export interface IdleOptions {
  client: ImapFlow;
  mailbox: string;
  pollingInterval: string;
  onNewMail: NewMailCallback;
  supportsIdle: boolean;
}

export async function startIdleLoop(options: IdleOptions): Promise<void> {
  const { client, mailbox, pollingInterval, onNewMail, supportsIdle } = options;
  const intervalMs = parseDuration(pollingInterval);

  if (supportsIdle) {
    await idleLoop(client, mailbox, intervalMs, onNewMail);
  } else {
    await pollingLoop(client, mailbox, intervalMs, onNewMail);
  }
}

async function idleLoop(
  client: ImapFlow,
  mailbox: string,
  fallbackIntervalMs: number,
  onNewMail: NewMailCallback
): Promise<void> {
  logger.info("Starting IDLE loop", { mailbox });

  while (!isShutdownInProgress()) {
    try {
      const lock = await client.getMailboxLock(mailbox);
      try {
        await client.idle();
      } finally {
        lock.release();
      }

      if (isShutdownInProgress()) break;

      const status = await client.status(mailbox, { messages: true });
      if (status.messages && status.messages > 0) {
        logger.debug("IDLE returned, checking for new mail", { mailbox });
        onNewMail(status.messages);
      }
    } catch (error) {
      if (isShutdownInProgress()) break;

      logger.warn("IDLE error, falling back to polling", {
        error: error instanceof Error ? error.message : String(error),
      });

      await sleep(fallbackIntervalMs);
    }
  }
}

async function pollingLoop(
  client: ImapFlow,
  mailbox: string,
  intervalMs: number,
  onNewMail: NewMailCallback
): Promise<void> {
  logger.info("Starting polling loop", { mailbox, intervalMs });

  while (!isShutdownInProgress()) {
    try {
      const status = await client.status(mailbox, { messages: true });
      if (status.messages && status.messages > 0) {
        logger.debug("Polling found messages", {
          mailbox,
          count: status.messages,
        });
        onNewMail(status.messages);
      }
    } catch (error) {
      if (isShutdownInProgress()) break;

      logger.error("Polling error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (!isShutdownInProgress()) {
      await sleep(intervalMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
