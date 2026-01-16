import { createLogger } from "../utils/logger.js";
import { parseDuration } from "../utils/duration.js";
import type { RetryConfig } from "../config/schema.js";
import {
  getEntriesDueForRetry,
  markRetrying,
  scheduleRetry,
  markRetryExhausted,
  markRetrySuccess,
  type DeadLetterEntry,
} from "./dead-letter.js";

const logger = createLogger("retry-manager");

export interface RetryManagerOptions {
  config: RetryConfig;
  onRetry: (entry: DeadLetterEntry) => Promise<boolean>;
}

let retryInterval: ReturnType<typeof setInterval> | null = null;
let retryOptions: RetryManagerOptions | null = null;

export function calculateNextRetryDelay(
  attempts: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number
): number {
  const delay = initialDelayMs * Math.pow(backoffMultiplier, attempts - 1);
  const jitter = delay * 0.1 * Math.random();
  return Math.min(delay + jitter, maxDelayMs);
}

export function startRetryManager(options: RetryManagerOptions): void {
  if (retryInterval) {
    logger.warn("Retry manager already started");
    return;
  }

  if (!options.config.enabled) {
    logger.debug("Retry manager disabled by configuration");
    return;
  }

  retryOptions = options;

  const checkIntervalMs = 60000;

  logger.debug("Starting retry manager", {
    maxAttempts: options.config.max_attempts,
    initialDelay: options.config.initial_delay,
    maxDelay: options.config.max_delay,
    backoffMultiplier: options.config.backoff_multiplier,
  });

  retryInterval = setInterval(() => {
    processRetries().catch((err: unknown) => {
      logger.error("Error processing retries", { error: err instanceof Error ? err.message : String(err) });
    });
  }, checkIntervalMs);

  processRetries().catch((err: unknown) => {
    logger.error("Error processing initial retries", { error: err instanceof Error ? err.message : String(err) });
  });
}

export function stopRetryManager(): void {
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
    retryOptions = null;
    logger.debug("Retry manager stopped");
  }
}

async function processRetries(): Promise<void> {
  if (!retryOptions) {
    return;
  }

  const { config, onRetry } = retryOptions;
  const entries = getEntriesDueForRetry();

  if (entries.length === 0) {
    return;
  }

  logger.debug("Processing due retries", { count: entries.length });

  const initialDelayMs = parseDuration(config.initial_delay);
  const maxDelayMs = parseDuration(config.max_delay);

  for (const entry of entries) {
    if (entry.attempts >= config.max_attempts) {
      logger.info("Dead letter exhausted max attempts", {
        id: entry.id,
        messageId: entry.messageId,
        attempts: entry.attempts,
        maxAttempts: config.max_attempts,
      });
      markRetryExhausted(entry.id);
      continue;
    }

    markRetrying(entry.id);

    try {
      const success = await onRetry(entry);

      if (success) {
        markRetrySuccess(entry.id);
        logger.info("Dead letter retry succeeded", {
          id: entry.id,
          messageId: entry.messageId,
          attempts: entry.attempts,
        });
      } else {
        const nextDelay = calculateNextRetryDelay(
          entry.attempts + 1,
          initialDelayMs,
          maxDelayMs,
          config.backoff_multiplier
        );
        const nextRetryAt = Date.now() + nextDelay;

        scheduleRetry(entry.id, nextRetryAt);

        logger.debug("Dead letter retry scheduled", {
          id: entry.id,
          messageId: entry.messageId,
          nextAttempt: entry.attempts + 1,
          nextRetryAt: new Date(nextRetryAt).toISOString(),
          delayMs: nextDelay,
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error("Dead letter retry failed", {
        id: entry.id,
        messageId: entry.messageId,
        error,
      });

      const nextDelay = calculateNextRetryDelay(
        entry.attempts + 1,
        initialDelayMs,
        maxDelayMs,
        config.backoff_multiplier
      );
      const nextRetryAt = Date.now() + nextDelay;

      scheduleRetry(entry.id, nextRetryAt);
    }
  }
}

export function getRetryManagerStatus(): { running: boolean; config: RetryConfig | null } {
  return {
    running: retryInterval !== null,
    config: retryOptions?.config ?? null,
  };
}
