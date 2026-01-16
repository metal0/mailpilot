import type { ImapFlow } from "imapflow";
import { createLogger } from "../utils/logger.js";
import { parseDuration } from "../utils/duration.js";
import { isShutdownInProgress } from "../utils/shutdown.js";

const logger = createLogger("imap-idle");

// Track active loops for stopping them
const activeLoops = new Map<string, { stop: boolean }>();

export type NewMailCallback = (count: number) => void;

export interface IdleOptions {
  client: ImapFlow;
  mailbox: string;
  pollingInterval: string;
  onNewMail: NewMailCallback;
  supportsIdle: boolean;
  loopKey?: string;
}

export async function startIdleLoop(options: IdleOptions): Promise<void> {
  const { client, mailbox, pollingInterval, onNewMail, supportsIdle, loopKey } = options;
  const intervalMs = parseDuration(pollingInterval);

  const control = { stop: false };
  if (loopKey) {
    activeLoops.set(loopKey, control);
  }

  try {
    if (supportsIdle) {
      await idleLoop(client, mailbox, intervalMs, onNewMail, control);
    } else {
      await pollingLoop(client, mailbox, intervalMs, onNewMail, control);
    }
  } finally {
    if (loopKey) {
      activeLoops.delete(loopKey);
    }
  }
}

export function stopIdleLoop(loopKey: string): boolean {
  const control = activeLoops.get(loopKey);
  if (control) {
    control.stop = true;
    logger.debug("Stopping IDLE loop", { loopKey });
    return true;
  }
  return false;
}

export function stopAllIdleLoops(): void {
  for (const [key, control] of activeLoops) {
    control.stop = true;
    logger.debug("Stopping IDLE loop", { key });
  }
  activeLoops.clear();
}

async function idleLoop(
  client: ImapFlow,
  mailbox: string,
  fallbackIntervalMs: number,
  onNewMail: NewMailCallback,
  control: { stop: boolean }
): Promise<void> {
  logger.debug("Starting IDLE loop", { mailbox });

  while (!isShutdownInProgress() && !control.stop) {
    try {
      const lock = await client.getMailboxLock(mailbox);
      try {
        await client.idle();
      } finally {
        lock.release();
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- control.stop is mutated externally
      if (isShutdownInProgress() || control.stop) break;

      const status = await client.status(mailbox, { unseen: true });
      if (status.unseen && status.unseen > 0) {
        logger.debug("IDLE returned, checking for new mail", { mailbox, unseen: status.unseen });
        onNewMail(status.unseen);
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- control.stop is mutated externally
      if (isShutdownInProgress() || control.stop) break;

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
  onNewMail: NewMailCallback,
  control: { stop: boolean }
): Promise<void> {
  logger.debug("Starting polling loop", { mailbox, intervalMs });

  while (!isShutdownInProgress() && !control.stop) {
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- control.stop is mutated externally
      if (isShutdownInProgress() || control.stop) break;

      logger.error("Polling error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- control.stop is mutated externally
    if (!isShutdownInProgress() && !control.stop) {
      await sleep(intervalMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
