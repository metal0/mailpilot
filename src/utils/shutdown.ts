import { createLogger } from "./logger.js";

const logger = createLogger("shutdown");

type ShutdownHandler = () => Promise<void> | void;

const handlers: ShutdownHandler[] = [];
let isShuttingDown = false;

export function onShutdown(handler: ShutdownHandler): void {
  handlers.push(handler);
}

export function isShutdownInProgress(): boolean {
  return isShuttingDown;
}

async function executeShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn("Shutdown already in progress, forcing exit");
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully`);

  const timeout = setTimeout(() => {
    logger.error("Shutdown timeout exceeded, forcing exit");
    process.exit(1);
  }, 30000);

  for (const handler of handlers.reverse()) {
    try {
      await handler();
    } catch (error) {
      logger.error("Shutdown handler failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  clearTimeout(timeout);
  logger.info("Shutdown complete");
  process.exit(0);
}

export function setupShutdownHandlers(): void {
  process.on("SIGTERM", () => void executeShutdown("SIGTERM"));
  process.on("SIGINT", () => void executeShutdown("SIGINT"));

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", {
      error: error.message,
      stack: error.stack,
    });
    void executeShutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
    void executeShutdown("unhandledRejection");
  });
}
