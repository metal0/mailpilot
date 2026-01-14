import type { Config, AccountConfig } from "../config/schema.js";
import { createImapClient, type ImapClient } from "../imap/client.js";
import { startIdleLoop, stopIdleLoop } from "../imap/idle.js";
import { createAccountContext, type AccountContext } from "./context.js";
import { processMailbox } from "../processor/worker.js";
import { registerWebhooks } from "../webhooks/dispatcher.js";
import { updateAccountStatus } from "../server/status.js";
import { createLogger } from "../utils/logger.js";
import { isShutdownInProgress, onShutdown } from "../utils/shutdown.js";

const logger = createLogger("account-manager");

const activeClients = new Map<string, ImapClient>();
const accountContexts = new Map<string, AccountContext>();
const pausedAccounts = new Set<string>();

// Queue status tracking
interface QueueStatus {
  accountName: string;
  folder: string;
  processing: boolean;
  pendingCount: number;
  startedAt?: number;
}

const processingQueue = new Map<string, QueueStatus>();

// Debounce tracking to prevent rapid re-processing
const lastProcessedAt = new Map<string, number>();
const PROCESS_DEBOUNCE_MS = 5000; // Minimum 5 seconds between processing same folder

export async function startAccount(
  config: Config,
  account: AccountConfig
): Promise<void> {
  const log = logger.child(account.name);

  log.info("Starting account");

  registerWebhooks(account.name, account.webhooks);

  const imapClient = createImapClient({
    config: account.imap,
    accountName: account.name,
  });

  try {
    await imapClient.connect();
    activeClients.set(account.name, imapClient);

    updateAccountStatus(account.name, {
      connected: true,
      idleSupported: imapClient.providerInfo.supportsIdle,
      llmProvider: account.llm?.provider ?? "default",
      llmModel: account.llm?.model ?? "default",
    });

    const ctx = createAccountContext(config, account, imapClient);
    if (!ctx) {
      throw new Error("Failed to create account context");
    }

    accountContexts.set(account.name, ctx);

    const watchFolders = account.folders?.watch ?? ["INBOX"];
    for (const folder of watchFolders) {
      await processMailbox(ctx, folder);
    }

    updateAccountStatus(account.name, { lastScan: new Date() });

    startWatching(ctx);
  } catch (error) {
    log.error("Failed to start account", {
      error: error instanceof Error ? error.message : String(error),
    });
    updateAccountStatus(account.name, { connected: false });
    throw error;
  }
}

function startWatching(ctx: AccountContext): void {
  const { account, imapClient, config } = ctx;
  const log = logger.child(account.name);

  const watchFolders = account.folders?.watch ?? ["INBOX"];
  for (const folder of watchFolders) {
    const loopKey = `${account.name}:${folder}`;
    void startIdleLoop({
      client: imapClient.client,
      mailbox: folder,
      pollingInterval: config.polling_interval,
      supportsIdle: imapClient.providerInfo.supportsIdle,
      loopKey,
      onNewMail: (count) => {
        if (pausedAccounts.has(account.name)) {
          log.debug("Account paused, skipping new mail", { folder, count });
          return;
        }

        // Debounce to prevent rapid re-processing (especially in dry_run mode)
        const queueKey = `${account.name}:${folder}`;
        const lastProcessed = lastProcessedAt.get(queueKey);
        const now = Date.now();
        if (lastProcessed && now - lastProcessed < PROCESS_DEBOUNCE_MS) {
          log.debug("Debouncing new mail notification", {
            folder,
            count,
            waitMs: PROCESS_DEBOUNCE_MS - (now - lastProcessed),
          });
          return;
        }

        log.debug("New mail notification", { folder, count });
        lastProcessedAt.set(queueKey, now);

        // Update queue status
        processingQueue.set(queueKey, {
          accountName: account.name,
          folder,
          processing: true,
          pendingCount: count,
          startedAt: now,
        });

        void processMailbox(ctx, folder)
          .then(() => {
            updateAccountStatus(account.name, { lastScan: new Date() });
            processingQueue.delete(queueKey);
          })
          .catch((error: unknown) => {
            log.error("Error processing mailbox", {
              folder,
              error: error instanceof Error ? error.message : String(error),
            });
            processingQueue.delete(queueKey);
          });
      },
    });
  }
}

export async function stopAllAccounts(): Promise<void> {
  logger.info("Stopping all accounts", { count: activeClients.size });

  const disconnectPromises: Promise<void>[] = [];

  for (const [name, client] of activeClients) {
    logger.debug("Disconnecting account", { name });
    disconnectPromises.push(
      client.disconnect().catch((error: unknown) => {
        logger.error("Error disconnecting account", {
          name,
          error: error instanceof Error ? error.message : String(error),
        });
      })
    );
  }

  await Promise.allSettled(disconnectPromises);
  activeClients.clear();
  accountContexts.clear();
  processingQueue.clear();
}

export function setupAccountShutdown(): void {
  onShutdown(async () => {
    if (!isShutdownInProgress()) return;
    await stopAllAccounts();
  });
}

export function getActiveAccountCount(): number {
  return activeClients.size;
}

// Queue status functions
export function getQueueStatus(): QueueStatus[] {
  return Array.from(processingQueue.values());
}

export function isProcessing(accountName: string): boolean {
  for (const status of processingQueue.values()) {
    if (status.accountName === accountName && status.processing) {
      return true;
    }
  }
  return false;
}

// Pause/Resume functions
export function pauseAccount(accountName: string): boolean {
  if (!activeClients.has(accountName)) {
    return false;
  }
  pausedAccounts.add(accountName);
  logger.info("Account paused", { accountName });
  return true;
}

export function resumeAccount(accountName: string): boolean {
  if (!activeClients.has(accountName)) {
    return false;
  }
  pausedAccounts.delete(accountName);
  logger.info("Account resumed", { accountName });
  return true;
}

export function isAccountPaused(accountName: string): boolean {
  return pausedAccounts.has(accountName);
}

export function getPausedAccounts(): string[] {
  return Array.from(pausedAccounts);
}

// Manual reconnect
export async function reconnectAccount(accountName: string): Promise<boolean> {
  const client = activeClients.get(accountName);
  const ctx = accountContexts.get(accountName);

  if (!client || !ctx) {
    logger.warn("Cannot reconnect: account not found", { accountName });
    return false;
  }

  logger.info("Reconnecting account", { accountName });

  try {
    // Stop IDLE loops for all watched folders
    const watchFolders = ctx.account.folders?.watch ?? ["INBOX"];
    for (const folder of watchFolders) {
      stopIdleLoop(`${accountName}:${folder}`);
    }

    // Disconnect
    await client.disconnect();
    updateAccountStatus(accountName, { connected: false });

    // Reconnect
    await client.connect();
    updateAccountStatus(accountName, {
      connected: true,
      idleSupported: client.providerInfo.supportsIdle,
    });

    // Restart watching
    startWatching(ctx);

    logger.info("Account reconnected successfully", { accountName });
    return true;
  } catch (error) {
    logger.error("Failed to reconnect account", {
      accountName,
      error: error instanceof Error ? error.message : String(error),
    });
    updateAccountStatus(accountName, { connected: false });
    return false;
  }
}

// Manual processing trigger
export async function triggerProcessing(accountName: string, folder = "INBOX"): Promise<boolean> {
  const ctx = accountContexts.get(accountName);

  if (!ctx) {
    logger.warn("Cannot trigger processing: account context not found", { accountName });
    return false;
  }

  if (pausedAccounts.has(accountName)) {
    logger.warn("Cannot trigger processing: account is paused", { accountName });
    return false;
  }

  logger.info("Manually triggering processing", { accountName, folder });

  try {
    await processMailbox(ctx, folder);
    updateAccountStatus(accountName, { lastScan: new Date() });
    return true;
  } catch (error) {
    logger.error("Manual processing failed", {
      accountName,
      folder,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
