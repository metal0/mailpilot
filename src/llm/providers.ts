import type { LlmProviderConfig } from "../config/schema.js";
import { createLogger } from "../utils/logger.js";
import { getRateLimitStats } from "./rate-limiter.js";
import { testConnection } from "./client.js";

const logger = createLogger("llm-providers");

const providers = new Map<string, LlmProviderConfig>();

// Track request counts
const requestCounts = new Map<string, { total: number; today: number; lastReset: number }>();

// Track health status
interface ProviderHealth {
  healthy: boolean;
  lastCheck: number;
  lastSuccessfulRequest: number;
  consecutiveFailures: number;
}
const providerHealth = new Map<string, ProviderHealth>();

const HEALTH_STALE_THRESHOLD = 10 * 60 * 1000; // 10 minutes

export function registerProviders(configs: LlmProviderConfig[]): void {
  providers.clear();

  for (const config of configs) {
    providers.set(config.name, config);
    requestCounts.set(config.name, { total: 0, today: 0, lastReset: getStartOfDay() });
    providerHealth.set(config.name, {
      healthy: true, // Assume healthy until proven otherwise
      lastCheck: 0,
      lastSuccessfulRequest: 0,
      consecutiveFailures: 0,
    });
    logger.debug("Registered LLM provider", {
      name: config.name,
      model: config.default_model,
    });
  }

  logger.debug("LLM providers registered", { count: configs.length });
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

  // Update health status on successful request
  const health = providerHealth.get(providerName);
  if (health) {
    health.healthy = true;
    health.lastSuccessfulRequest = Date.now();
    health.consecutiveFailures = 0;
  }
}

export function recordProviderFailure(providerName: string): void {
  const health = providerHealth.get(providerName);
  if (!health) return;

  health.consecutiveFailures++;
  if (health.consecutiveFailures >= 3) {
    health.healthy = false;
  }
}

export function updateProviderHealth(providerName: string, healthy: boolean): void {
  const health = providerHealth.get(providerName);
  if (!health) return;

  health.healthy = healthy;
  health.lastCheck = Date.now();
  if (healthy) {
    health.consecutiveFailures = 0;
  }
}

export function getProviderHealth(providerName: string): ProviderHealth | undefined {
  return providerHealth.get(providerName);
}

export function isProviderHealthStale(providerName: string): boolean {
  const health = providerHealth.get(providerName);
  if (!health) return true;

  const now = Date.now();
  const lastActivity = Math.max(health.lastCheck, health.lastSuccessfulRequest);
  return lastActivity === 0 || (now - lastActivity) > HEALTH_STALE_THRESHOLD;
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
  healthy: boolean;
  healthStale: boolean;
}

export function getProviderStats(): Record<string, ProviderStats> {
  const stats: Record<string, ProviderStats> = {};

  for (const [name, config] of providers) {
    const counts = requestCounts.get(name) ?? { total: 0, today: 0, lastReset: 0 };
    const rateLimitInfo = getRateLimitStats(config.api_url);
    const health = providerHealth.get(name);

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
      healthy: health?.healthy ?? true,
      healthStale: isProviderHealthStale(name),
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

async function checkStaleProviders(): Promise<void> {
  const allProviders = getAllProviders();
  if (allProviders.length === 0) {
    return;
  }

  const staleProviders = allProviders.filter((p) => isProviderHealthStale(p.name));
  if (staleProviders.length === 0) {
    return;
  }

  logger.debug("Checking stale providers", { count: staleProviders.length });

  for (const provider of staleProviders) {
    const healthy = await testConnection(provider, provider.default_model);
    updateProviderHealth(provider.name, healthy);

    if (healthy) {
      logger.debug("Provider health check passed", { provider: provider.name });
    } else {
      logger.warn("Provider health check failed", { provider: provider.name });
    }
  }
}

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

export async function startHealthChecks(): Promise<void> {
  // Run initial check for all stale providers
  await checkStaleProviders();

  // Run periodic checks every 5 minutes for stale providers only
  healthCheckInterval = setInterval(() => {
    checkStaleProviders().catch((err: unknown) => {
      logger.error("Health check failed", { error: err instanceof Error ? err.message : String(err) });
    });
  }, 5 * 60 * 1000);

  logger.debug("LLM health checks started");
}

export function stopHealthChecks(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}
