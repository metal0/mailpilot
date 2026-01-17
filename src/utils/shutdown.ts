import { createLogger } from "./logger.js";
import { inflightTracker } from "./inflight.js";
import { parseDuration } from "./duration.js";
import type { ShutdownConfig } from "../config/schema.js";

const logger = createLogger("shutdown");

type ShutdownHandler = () => Promise<void> | void;

const handlers: ShutdownHandler[] = [];
let isShuttingDown = false;
let shutdownConfig: ShutdownConfig | undefined;
let broadcastShutdownFn: ((data: unknown) => void) | null = null;

export function configureShutdown(config?: ShutdownConfig): void {
  shutdownConfig = config;
}

export function setShutdownBroadcast(fn: (data: unknown) => void): void {
  broadcastShutdownFn = fn;
}

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

  const timeoutMs = shutdownConfig?.timeout
    ? parseDuration(shutdownConfig.timeout)
    : 30000;

  const forceAfterMs = shutdownConfig?.force_after
    ? parseDuration(shutdownConfig.force_after)
    : 25000;

  const waitForInflight = shutdownConfig?.wait_for_inflight ?? true;

  // Broadcast shutdown notification to dashboard clients
  if (broadcastShutdownFn) {
    broadcastShutdownFn({
      type: "shutdown",
      signal,
      inflight: inflightTracker.getCount(),
    });
  }

  // Set hard timeout for entire shutdown process
  const hardTimeout = setTimeout(() => {
    logger.error("Shutdown timeout exceeded, forcing exit");
    process.exit(1);
  }, timeoutMs);

  // Wait for in-flight operations if configured
  if (waitForInflight) {
    const active = inflightTracker.getActive();
    if (active.length > 0) {
      logger.info(`Waiting for ${active.length} in-flight operations to complete`, {
        operations: active.map((op) => op.description),
      });

      const completed = await inflightTracker.waitForAll(forceAfterMs);

      if (!completed) {
        const remaining = inflightTracker.getActive();
        logger.warn("Some operations did not complete before timeout", {
          remaining: remaining.map((op) => ({
            description: op.description,
            durationMs: op.durationMs,
          })),
        });
      } else {
        logger.info("All in-flight operations completed");
      }
    }
  }

  // Execute shutdown handlers in reverse order
  for (const handler of handlers.reverse()) {
    try {
      await handler();
    } catch (error) {
      logger.error("Shutdown handler failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  clearTimeout(hardTimeout);
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
