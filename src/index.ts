import { loadConfig } from "./config/loader.js";
import { initDatabase, closeDatabase } from "./storage/database.js";
import { cleanupProcessedMessages } from "./storage/processed.js";
import { cleanupAuditLog } from "./storage/audit.js";
import { registerProviders } from "./llm/providers.js";
import { startServer, stopServer } from "./server/index.js";
import { startAccount, setupAccountShutdown } from "./accounts/manager.js";
import { dispatchStartup, dispatchShutdown } from "./webhooks/dispatcher.js";
import {
  createLogger,
  setLogLevel,
  type LogLevel,
} from "./utils/logger.js";
import { setupShutdownHandlers, onShutdown } from "./utils/shutdown.js";

const logger = createLogger("main");

async function main(): Promise<void> {
  logger.info("Mailpilot starting");

  setupShutdownHandlers();
  setupAccountShutdown();

  const configPath = process.env["CONFIG_PATH"] ?? "./config.yaml";
  const config = loadConfig(configPath);

  const loggingConfig = config.logging ?? { level: "info" as const };
  const stateConfig = config.state ?? {
    database_path: "./data/mailpilot.db",
    processed_ttl: "24h",
    audit_retention: "30d",
  };
  const serverConfig = config.server ?? { port: 8080 };

  setLogLevel(loggingConfig.level as LogLevel);

  initDatabase(stateConfig.database_path);

  onShutdown(async () => {
    await dispatchShutdown("shutdown");
    await stopServer();
    closeDatabase();
  });

  registerProviders(config.llm_providers);

  startServer(serverConfig, config.accounts);

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

  const cleanupInterval = setInterval(
    () => {
      cleanupProcessedMessages(stateConfig.processed_ttl);
      cleanupAuditLog(stateConfig.audit_retention);
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
