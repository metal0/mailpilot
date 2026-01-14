import type { LlmProviderConfig } from "../config/schema.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("llm-providers");

const providers = new Map<string, LlmProviderConfig>();

export function registerProviders(configs: LlmProviderConfig[]): void {
  providers.clear();

  for (const config of configs) {
    providers.set(config.name, config);
    logger.debug("Registered LLM provider", {
      name: config.name,
      model: config.default_model,
    });
  }

  logger.info("LLM providers registered", { count: configs.length });
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

export function getProviderStats(): Record<
  string,
  { requestsToday: number; rateLimited: boolean }
> {
  const stats: Record<string, { requestsToday: number; rateLimited: boolean }> =
    {};

  for (const [name] of providers) {
    stats[name] = { requestsToday: 0, rateLimited: false };
  }

  return stats;
}
