import type { AccountConfig, Config, LlmProviderConfig } from "../config/schema.js";
import type { ImapClient } from "../imap/client.js";
import { getProviderForAccount } from "../llm/providers.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("account-context");

export interface AccountContext {
  config: Config;
  account: AccountConfig;
  imapClient: ImapClient;
  provider: LlmProviderConfig;
  model: string;
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

  return {
    config,
    account,
    imapClient,
    provider: llmInfo.provider,
    model: llmInfo.model,
  };
}
