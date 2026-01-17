import type { Config, AccountConfig } from "../config/schema.js";
import { DEFAULT_POLLING_INTERVAL } from "../config/schema.js";
import { loadConfig } from "../config/loader.js";
import { createImapClient, type ImapClient } from "../imap/client.js";
import { startIdleLoop, stopIdleLoop } from "../imap/idle.js";
import { createAccountContext, type AccountContext } from "./context.js";
import { processMailbox } from "../processor/worker.js";
import { registerWebhooks, unregisterWebhooks } from "../webhooks/dispatcher.js";
import { updateAccountStatus, removeAccountStatus } from "../server/status.js";
import { registerProviders, getProviderForAccount } from "../llm/providers.js";
import { createLogger } from "../utils/logger.js";
import { isShutdownInProgress, onShutdown } from "../utils/shutdown.js";

const logger = createLogger("account-manager");

// Store current config path and config for reload
let currentConfigPath: string | null = null;
let currentConfig: Config | null = null;

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

  log.debug("Starting account");

  registerWebhooks(account.name, account.webhooks);

  const imapClient = createImapClient({
    config: account.imap,
    accountName: account.name,
  });

  try {
    await imapClient.connect();
    activeClients.set(account.name, imapClient);

    // Resolve actual LLM provider/model (even if using defaults)
    const llmInfo = getProviderForAccount(account.llm?.provider, account.llm?.model);

    updateAccountStatus(account.name, {
      connected: true,
      idleSupported: imapClient.providerInfo.supportsIdle,
      llmProvider: llmInfo?.provider.name ?? "none",
      llmModel: llmInfo?.model ?? "none",
      imapHost: account.imap.host,
      imapPort: account.imap.port,
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
  const { account, imapClient } = ctx;
  const log = logger.child(account.name);

  // Use per-account polling interval, falling back to hardcoded default (60s)
  const pollingInterval = account.polling_interval ?? DEFAULT_POLLING_INTERVAL;

  const watchFolders = account.folders?.watch ?? ["INBOX"];
  for (const folder of watchFolders) {
    const loopKey = `${account.name}:${folder}`;
    void startIdleLoop({
      client: imapClient.client,
      mailbox: folder,
      pollingInterval,
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
  logger.debug("Stopping all accounts", { count: activeClients.size });

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
  updateAccountStatus(accountName, { paused: true });
  logger.info("Account paused", { accountName });
  return true;
}

export function resumeAccount(accountName: string): boolean {
  if (!activeClients.has(accountName)) {
    return false;
  }
  pausedAccounts.delete(accountName);
  updateAccountStatus(accountName, { paused: false });
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
  const oldClient = activeClients.get(accountName);
  const ctx = accountContexts.get(accountName);

  if (!oldClient || !ctx) {
    logger.warn("Cannot reconnect: account not found", { accountName });
    return false;
  }

  logger.debug("Reconnecting account", { accountName });

  try {
    // Stop IDLE loops for all watched folders
    const watchFolders = ctx.account.folders?.watch ?? ["INBOX"];
    for (const folder of watchFolders) {
      stopIdleLoop(`${accountName}:${folder}`);
    }

    // Disconnect old client
    try {
      await oldClient.disconnect();
    } catch (disconnectError) {
      logger.debug("Error disconnecting old client (ignored)", {
        accountName,
        error: disconnectError instanceof Error ? disconnectError.message : String(disconnectError),
      });
    }
    updateAccountStatus(accountName, { connected: false });

    // Create a new ImapClient instance (ImapFlow cannot be reused after disconnect)
    const newClient = createImapClient({
      config: ctx.account.imap,
      accountName: ctx.account.name,
    });

    // Connect the new client
    await newClient.connect();

    // Update the maps with the new client
    activeClients.set(accountName, newClient);

    // Create a new context with the new client
    const newCtx = createAccountContext(ctx.config, ctx.account, newClient);
    if (!newCtx) {
      throw new Error("Failed to create new account context");
    }
    accountContexts.set(accountName, newCtx);

    updateAccountStatus(accountName, {
      connected: true,
      idleSupported: newClient.providerInfo.supportsIdle,
    });

    // Restart watching with the new context
    startWatching(newCtx);

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

// Get ImapClient for an account (for email preview)
export function getAccountClient(accountName: string): ImapClient | undefined {
  return activeClients.get(accountName);
}

// Get AccountContext for retries
export function getAccountContext(accountName: string): AccountContext | undefined {
  return accountContexts.get(accountName);
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

  logger.debug("Manually triggering processing", { accountName, folder });

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

// Store config path for reloading
export function setConfigPath(path: string): void {
  currentConfigPath = path;
}

export function setCurrentConfig(config: Config): void {
  currentConfig = config;
}

export function getCurrentConfig(): Config | null {
  return currentConfig;
}

// Stop a single account gracefully
async function stopAccount(accountName: string): Promise<void> {
  const client = activeClients.get(accountName);
  const ctx = accountContexts.get(accountName);

  if (!client || !ctx) {
    return;
  }

  logger.debug("Stopping account", { accountName });

  // Stop IDLE loops
  const watchFolders = ctx.account.folders?.watch ?? ["INBOX"];
  for (const folder of watchFolders) {
    stopIdleLoop(`${accountName}:${folder}`);
  }

  // Clear processing queue entries for this account
  for (const [key, status] of processingQueue) {
    if (status.accountName === accountName) {
      processingQueue.delete(key);
    }
  }

  // Clear debounce tracking
  for (const key of lastProcessedAt.keys()) {
    if (key.startsWith(`${accountName}:`)) {
      lastProcessedAt.delete(key);
    }
  }

  // Disconnect IMAP client
  try {
    await client.disconnect();
  } catch (error) {
    logger.debug("Error disconnecting account (ignored)", {
      accountName,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Cleanup
  activeClients.delete(accountName);
  accountContexts.delete(accountName);
  pausedAccounts.delete(accountName);
  unregisterWebhooks(accountName);
  removeAccountStatus(accountName);

  logger.debug("Account stopped", { accountName });
}

// Compare account configs to detect changes
function accountConfigChanged(oldConfig: AccountConfig, newConfig: AccountConfig): boolean {
  // Compare IMAP settings
  if (
    oldConfig.imap.host !== newConfig.imap.host ||
    oldConfig.imap.port !== newConfig.imap.port ||
    oldConfig.imap.username !== newConfig.imap.username ||
    oldConfig.imap.password !== newConfig.imap.password ||
    oldConfig.imap.auth !== newConfig.imap.auth ||
    oldConfig.imap.tls !== newConfig.imap.tls
  ) {
    return true;
  }

  // Compare LLM settings
  if (
    oldConfig.llm?.provider !== newConfig.llm?.provider ||
    oldConfig.llm?.model !== newConfig.llm?.model
  ) {
    return true;
  }

  // Compare folder settings
  const oldFolders = oldConfig.folders?.watch ?? ["INBOX"];
  const newFolders = newConfig.folders?.watch ?? ["INBOX"];
  if (JSON.stringify(oldFolders.sort()) !== JSON.stringify(newFolders.sort())) {
    return true;
  }

  return false;
}

export interface ReloadResult {
  success: boolean;
  added: string[];
  removed: string[];
  restarted: string[];
  unchanged: string[];
  errors: string[];
}

export async function reloadConfig(): Promise<ReloadResult> {
  if (!currentConfigPath) {
    throw new Error("Config path not set - cannot reload");
  }

  const result: ReloadResult = {
    success: true,
    added: [],
    removed: [],
    restarted: [],
    unchanged: [],
    errors: [],
  };

  logger.debug("Reloading configuration", { path: currentConfigPath });

  let newConfig: Config;
  try {
    newConfig = loadConfig(currentConfigPath);
  } catch (error) {
    logger.error("Failed to load config", {
      error: error instanceof Error ? error.message : String(error),
    });
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : String(error));
    return result;
  }

  const oldConfig = currentConfig;
  if (!oldConfig) {
    result.success = false;
    result.errors.push("No current config to compare against");
    return result;
  }

  // Update LLM providers
  registerProviders(newConfig.llm_providers);

  // Find accounts to add, remove, or restart
  const oldAccountNames = new Set(oldConfig.accounts.map((a) => a.name));
  const newAccountNames = new Set(newConfig.accounts.map((a) => a.name));

  const toAdd: AccountConfig[] = [];
  const toRemove: string[] = [];
  const toRestart: AccountConfig[] = [];

  // Find removed accounts
  for (const name of oldAccountNames) {
    if (!newAccountNames.has(name)) {
      toRemove.push(name);
    }
  }

  // Find new and changed accounts
  for (const newAccount of newConfig.accounts) {
    if (!oldAccountNames.has(newAccount.name)) {
      toAdd.push(newAccount);
    } else {
      const oldAccount = oldConfig.accounts.find((a) => a.name === newAccount.name);
      if (oldAccount && accountConfigChanged(oldAccount, newAccount)) {
        toRestart.push(newAccount);
      } else {
        result.unchanged.push(newAccount.name);
      }
    }
  }

  // Stop removed accounts
  for (const name of toRemove) {
    try {
      await stopAccount(name);
      result.removed.push(name);
    } catch (error) {
      logger.error("Failed to stop removed account", {
        accountName: name,
        error: error instanceof Error ? error.message : String(error),
      });
      result.errors.push(`Failed to stop ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Restart changed accounts
  for (const account of toRestart) {
    try {
      await stopAccount(account.name);
      await startAccount(newConfig, account);
      result.restarted.push(account.name);
    } catch (error) {
      logger.error("Failed to restart account", {
        accountName: account.name,
        error: error instanceof Error ? error.message : String(error),
      });
      result.errors.push(`Failed to restart ${account.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Start new accounts
  for (const account of toAdd) {
    try {
      await startAccount(newConfig, account);
      result.added.push(account.name);
    } catch (error) {
      logger.error("Failed to start new account", {
        accountName: account.name,
        error: error instanceof Error ? error.message : String(error),
      });
      result.errors.push(`Failed to start ${account.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Update current config
  currentConfig = newConfig;

  if (result.errors.length > 0) {
    result.success = false;
  }

  logger.info("Configuration reloaded", {
    added: result.added.length,
    removed: result.removed.length,
    restarted: result.restarted.length,
    unchanged: result.unchanged.length,
    errors: result.errors.length,
  });

  return result;
}
