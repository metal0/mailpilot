import type { AccountConfig, Config, LlmProviderConfig } from "../config/schema.js";
import type { ImapClient } from "../imap/client.js";
import { getProviderForAccount } from "../llm/providers.js";
import { createAntivirusScanner, type AntivirusScanner } from "../processor/antivirus.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("account-context");

let sharedAvScanner: AntivirusScanner | undefined;

export interface AccountContext {
  config: Config;
  account: AccountConfig;
  imapClient: ImapClient;
  provider: LlmProviderConfig;
  model: string;
  antivirusScanner?: AntivirusScanner;
}

export function createAccountContext(
  config: Config,
  account: AccountConfig,
  imapClient: ImapClient
): AccountContext | null {
  const llmInfo = getProviderForAccount(
    account.llm?.provider,
    account.llm?.model
  );

  if (!llmInfo) {
    logger.error("Failed to resolve LLM provider for account", {
      account: account.name,
      provider: account.llm?.provider,
    });
    return null;
  }

  // Initialize shared antivirus scanner if enabled
  let antivirusScanner: AntivirusScanner | undefined;
  const avConfig = config.antivirus;
  if (avConfig?.enabled) {
    if (!sharedAvScanner) {
      sharedAvScanner = createAntivirusScanner(avConfig);
      logger.info("Antivirus scanner initialized", {
        host: avConfig.host,
        port: avConfig.port,
      });
    }
    antivirusScanner = sharedAvScanner;
  }

  const context: AccountContext = {
    config,
    account,
    imapClient,
    provider: llmInfo.provider,
    model: llmInfo.model,
  };

  if (antivirusScanner) {
    context.antivirusScanner = antivirusScanner;
  }

  return context;
}
