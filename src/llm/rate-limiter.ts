import { createLogger } from "../utils/logger.js";

const logger = createLogger("rate-limiter");

interface RateLimiterState {
  requests: number[];
  retryAfter: number | null;
}

const limiters = new Map<string, RateLimiterState>();

export function getRateLimiter(apiUrl: string): RateLimiterState {
  let state = limiters.get(apiUrl);
  if (!state) {
    state = { requests: [], retryAfter: null };
    limiters.set(apiUrl, state);
  }
  return state;
}

export async function acquireRateLimit(
  apiUrl: string,
  rpmLimit?: number
): Promise<void> {
  const state = getRateLimiter(apiUrl);

  if (state.retryAfter && Date.now() < state.retryAfter) {
    const waitMs = state.retryAfter - Date.now();
    logger.warn("Rate limited, waiting", { apiUrl, waitMs });
    await sleep(waitMs);
    state.retryAfter = null;
  }

  if (rpmLimit) {
    const windowStart = Date.now() - 60_000;
    state.requests = state.requests.filter((t) => t > windowStart);

    if (state.requests.length >= rpmLimit) {
      const oldestRequest = state.requests[0];
      if (oldestRequest !== undefined) {
        const waitMs = oldestRequest + 60_000 - Date.now() + 100;
        if (waitMs > 0) {
          logger.debug("Rate limit reached, waiting", { apiUrl, waitMs });
          await sleep(waitMs);
          state.requests = state.requests.filter((t) => t > Date.now() - 60_000);
        }
      }
    }
  }

  state.requests.push(Date.now());
}

export function handleRateLimitResponse(
  apiUrl: string,
  retryAfterSeconds?: number
): void {
  const state = getRateLimiter(apiUrl);

  if (retryAfterSeconds) {
    state.retryAfter = Date.now() + retryAfterSeconds * 1000;
    logger.warn("Received rate limit response", {
      apiUrl,
      retryAfterSeconds,
    });
  } else {
    state.retryAfter = Date.now() + 60_000;
    logger.warn("Received rate limit response (defaulting to 60s)", { apiUrl });
  }
}

export function getRateLimitStats(apiUrl: string): {
  requestsInLastMinute: number;
  isLimited: boolean;
} {
  const state = getRateLimiter(apiUrl);
  const windowStart = Date.now() - 60_000;
  const recentRequests = state.requests.filter((t) => t > windowStart);

  return {
    requestsInLastMinute: recentRequests.length,
    isLimited: state.retryAfter !== null && Date.now() < state.retryAfter,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
