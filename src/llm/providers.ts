import type { LlmProviderConfig } from "../config/schema.js";
import { createLogger } from "../utils/logger.js";
import { getRateLimitStats } from "./rate-limiter.js";

const logger = createLogger("llm-providers");

const providers = new Map<string, LlmProviderConfig>();

// Track request counts
const requestCounts = new Map<string, { total: number; today: number; lastReset: number }>();

export function registerProviders(configs: LlmProviderConfig[]): void {
  providers.clear();

  for (const config of configs) {
    providers.set(config.name, config);
    requestCounts.set(config.name, { total: 0, today: 0, lastReset: getStartOfDay() });
    logger.debug("Registered LLM provider", {
      name: config.name,
      model: config.default_model,
    });
  }

  logger.info("LLM providers registered", { count: configs.length });
}

function getStartOfDay(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

export function recordProviderRequest(providerName: string): void {
  const counts = requestCounts.get(providerName);
  if (!counts) return;

  const startOfDay = getStartOfDay();
  if (counts.lastReset < startOfDay) {
    counts.today = 0;
    counts.lastReset = startOfDay;
  }

  counts.total++;
  counts.today++;
}

export function getProvider(name: string): LlmProviderConfig | undefined {
  return providers.get(name);
}

export function getDefaultProvider(): LlmProviderConfig | undefined {
  const first = providers.values().next();
  return first.done ? undefined : first.value;
}

export function getAllProviders(): LlmProviderConfig[] {
  return Array.from(providers.values());
}

export function getProviderForAccount(
  providerName?: string,
  modelOverride?: string
): { provider: LlmProviderConfig; model: string } | undefined {
  let provider: LlmProviderConfig | undefined;

  if (providerName) {
    provider = getProvider(providerName);
    if (!provider) {
      logger.error("Unknown LLM provider", { name: providerName });
      return undefined;
    }
  } else {
    provider = getDefaultProvider();
    if (!provider) {
      logger.error("No LLM providers configured");
      return undefined;
    }
  }

  const model = modelOverride ?? provider.default_model;

  return { provider, model };
}

export interface ProviderStats {
  name: string;
  model: string;
  requestsToday: number;
  requestsTotal: number;
  requestsLastMinute: number;
  rateLimited: boolean;
  rpmLimit?: number;
}

export function getProviderStats(): Record<string, ProviderStats> {
  const stats: Record<string, ProviderStats> = {};

  for (const [name, config] of providers) {
    const counts = requestCounts.get(name) ?? { total: 0, today: 0, lastReset: 0 };
    const rateLimitInfo = getRateLimitStats(config.api_url);

    // Reset today count if day changed
    const startOfDay = getStartOfDay();
    if (counts.lastReset < startOfDay) {
      counts.today = 0;
      counts.lastReset = startOfDay;
    }

    const stat: ProviderStats = {
      name,
      model: config.default_model,
      requestsToday: counts.today,
      requestsTotal: counts.total,
      requestsLastMinute: rateLimitInfo.requestsInLastMinute,
      rateLimited: rateLimitInfo.isLimited,
    };
    if (config.rate_limit_rpm !== undefined) {
      stat.rpmLimit = config.rate_limit_rpm;
    }
    stats[name] = stat;
  }

  return stats;
}

export function getDetailedProviderStats(): ProviderStats[] {
  return Object.values(getProviderStats());
}
