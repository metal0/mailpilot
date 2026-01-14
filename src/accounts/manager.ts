import type { Config, AccountConfig } from "../config/schema.js";
import { createImapClient, type ImapClient } from "../imap/client.js";
import { startIdleLoop } from "../imap/idle.js";
import { createAccountContext, type AccountContext } from "./context.js";
import { processMailbox } from "../processor/worker.js";
import { registerWebhooks } from "../webhooks/dispatcher.js";
import { updateAccountStatus } from "../server/status.js";
import { createLogger } from "../utils/logger.js";
import { isShutdownInProgress, onShutdown } from "../utils/shutdown.js";

const logger = createLogger("account-manager");

const activeClients = new Map<string, ImapClient>();

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
    void startIdleLoop({
      client: imapClient.client,
      mailbox: folder,
      pollingInterval: config.polling_interval,
      supportsIdle: imapClient.providerInfo.supportsIdle,
      onNewMail: (count) => {
        log.debug("New mail notification", { folder, count });
        void processMailbox(ctx, folder)
          .then(() => {
            updateAccountStatus(account.name, { lastScan: new Date() });
          })
          .catch((error: unknown) => {
            log.error("Error processing mailbox", {
              folder,
              error: error instanceof Error ? error.message : String(error),
            });
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
