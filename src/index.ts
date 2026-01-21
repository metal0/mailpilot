import { readFileSync } from "node:fs";
import { loadConfig } from "./config/loader.js";
import { initDatabase, closeDatabase } from "./storage/database.js";
import { cleanupProcessedMessages } from "./storage/processed.js";
import { cleanupAuditLog } from "./storage/audit.js";
import { cleanupDeadLetters, type DeadLetterEntry } from "./storage/dead-letter.js";
import { startRetryManager, stopRetryManager } from "./storage/retry-manager.js";
import { getAccountContext } from "./accounts/manager.js";
import { processMessage } from "./processor/worker.js";
import { registerProviders, startHealthChecks, stopHealthChecks } from "./llm/providers.js";
import { startServer, stopServer } from "./server/index.js";
import { startAccount, setupAccountShutdown, setConfigPath, setCurrentConfig, loadPausedAccounts } from "./accounts/manager.js";
import { dispatchStartup, dispatchShutdown } from "./webhooks/dispatcher.js";
import {
  createLogger,
  setLogLevel,
  type LogLevel,
} from "./utils/logger.js";
import { setupShutdownHandlers, onShutdown, configureShutdown } from "./utils/shutdown.js";

const logger = createLogger("main");

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")) as { version: string };
    return pkg.version;
  } catch {
    return "unknown";
  }
}

async function main(): Promise<void> {
  const version = getVersion();
  logger.info(`Mailpilot v${version} starting`);

  setupShutdownHandlers();
  setupAccountShutdown();

  const configPath = process.env["CONFIG_PATH"] ?? "./config.yaml";
  const config = loadConfig(configPath);

  // Configure shutdown with config settings
  configureShutdown(config.shutdown);

  // Store for hot reload
  setConfigPath(configPath);
  setCurrentConfig(config);

  const loggingConfig = config.logging ?? { level: "info" as const };
  const stateConfig = config.state ?? {
    database_path: "./data/mailpilot.db",
    processed_ttl: "24h",
    audit_retention: "30d",
  };
  const serverConfig = config.server ?? { port: 8080 };
  const dashboardConfig = config.dashboard;

  setLogLevel(loggingConfig.level as LogLevel);

  initDatabase(stateConfig.database_path);

  // Load persisted paused accounts before starting them
  loadPausedAccounts();

  onShutdown(async () => {
    await dispatchShutdown("shutdown");
    await stopServer();
    closeDatabase();
  });

  registerProviders(config.llm_providers);
  // Start health checks in background - don't block startup
  startHealthChecks().catch((err: unknown) => {
    logger.error("Initial health check failed", { error: err instanceof Error ? err.message : String(err) });
  });

  onShutdown(() => {
    stopHealthChecks();
  });

  await startServer(serverConfig, config.accounts, dashboardConfig, config.attachments, config.antivirus, config.dry_run, configPath);

  await dispatchStartup();

  const startPromises = config.accounts.map((account) =>
    startAccount(config, account).catch((error: unknown) => {
      logger.error("Failed to start account", {
        account: account.name,
        error: error instanceof Error ? error.message : String(error),
      });
    })
  );

  await Promise.allSettled(startPromises);

  // Start retry manager for dead letter entries
  const retryConfig = config.retry ?? {
    enabled: true,
    max_attempts: 5,
    initial_delay: "5m",
    max_delay: "24h",
    backoff_multiplier: 2,
  };

  startRetryManager({
    config: retryConfig,
    onRetry: async (entry: DeadLetterEntry): Promise<boolean> => {
      const ctx = getAccountContext(entry.accountName);
      if (!ctx) {
        logger.warn("Cannot retry: account context not found", {
          accountName: entry.accountName,
          messageId: entry.messageId,
        });
        return false;
      }

      try {
        const success = await processMessage(ctx, entry.folder, entry.uid, entry.messageId);
        return success;
      } catch (error) {
        logger.error("Retry processing failed", {
          id: entry.id,
          messageId: entry.messageId,
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },
  });

  onShutdown(() => {
    stopRetryManager();
  });

  const cleanupInterval = setInterval(
    () => {
      cleanupProcessedMessages(stateConfig.processed_ttl);
      cleanupAuditLog(stateConfig.audit_retention);
      cleanupDeadLetters(stateConfig.audit_retention);
    },
    60 * 60 * 1000
  );

  onShutdown(() => {
    clearInterval(cleanupInterval);
  });

  logger.info("Mailpilot started", {
    accounts: config.accounts.length,
    providers: config.llm_providers.length,
  });
}

main().catch((error: unknown) => {
  logger.error("Fatal error", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
