import type { AccountConfig, Config, LlmProviderConfig } from "../config/schema.js";
import type { ImapClient } from "../imap/client.js";
import { getProviderForAccount } from "../llm/providers.js";
import { createAntivirusScanner, type AntivirusScanner } from "../processor/antivirus.js";
import { createAttachmentProcessor, type AttachmentProcessor } from "../attachments/index.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("account-context");

let sharedAvScanner: AntivirusScanner | undefined;
let sharedAttachmentProcessor: AttachmentProcessor | undefined;

export interface AccountContext {
  config: Config;
  account: AccountConfig;
  imapClient: ImapClient;
  provider: LlmProviderConfig;
  model: string;
  antivirusScanner?: AntivirusScanner;
  attachmentProcessor?: AttachmentProcessor;
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

  // Initialize shared attachment processor if enabled
  let attachmentProcessor: AttachmentProcessor | undefined;
  const attConfig = config.attachments;
  if (attConfig?.enabled) {
    if (!sharedAttachmentProcessor) {
      sharedAttachmentProcessor = createAttachmentProcessor(attConfig);
      logger.info("Attachment processor initialized", {
        tikaUrl: attConfig.tika_url ?? "http://localhost:9998",
        maxSizeMb: attConfig.max_size_mb,
        extractImages: attConfig.extract_images,
      });
    }
    attachmentProcessor = sharedAttachmentProcessor;
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

  if (attachmentProcessor) {
    context.attachmentProcessor = attachmentProcessor;
  }

  return context;
}
