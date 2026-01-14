import type { ImapClient } from "../imap/client.js";
import type { AccountConfig, Config, LlmProviderConfig } from "../config/schema.js";
import { createLogger } from "../utils/logger.js";
import { isShutdownInProgress } from "../utils/shutdown.js";
import { isMessageProcessed, markMessageProcessed } from "../storage/processed.js";
import { logAction } from "../storage/audit.js";
import { fetchAndParseEmail } from "./email.js";
import { buildPrompt, truncateToTokens, type EmailContext, type PromptOptions } from "../llm/prompt.js";
import { classifyEmail } from "../llm/client.js";
import { loadPrompt } from "../config/loader.js";
import { executeAction } from "../actions/executor.js";
import type { LlmAction } from "../llm/parser.js";

const logger = createLogger("worker");

export interface WorkerContext {
  config: Config;
  account: AccountConfig;
  imapClient: ImapClient;
  provider: LlmProviderConfig;
  model: string;
}

export async function processMailbox(
  ctx: WorkerContext,
  folder: string
): Promise<number> {
  const { account, imapClient, config } = ctx;
  const log = logger.child(account.name);

  log.debug("Processing mailbox", { folder });

  const messages = await imapClient.getUnseenMessages(folder);
  let processed = 0;

  const concurrency = config.concurrency_limit;
  const batches: Array<typeof messages> = [];

  for (let i = 0; i < messages.length; i += concurrency) {
    batches.push(messages.slice(i, i + concurrency));
  }

  for (const batch of batches) {
    if (isShutdownInProgress()) break;

    const results = await Promise.allSettled(
      batch.map((msg) => processMessage(ctx, folder, msg.uid, msg.messageId))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        processed++;
      }
    }
  }

  log.info("Processed mailbox", { folder, processed, total: messages.length });
  return processed;
}

async function processMessage(
  ctx: WorkerContext,
  folder: string,
  uid: number,
  messageId: string
): Promise<boolean> {
  const { account, imapClient, provider, model, config } = ctx;
  const log = logger.child(account.name);

  if (isMessageProcessed(messageId, account.name)) {
    log.debug("Message already processed", { messageId });
    return false;
  }

  try {
    const email = await fetchAndParseEmail(imapClient.client, folder, uid);

    const foldersConfig = account.folders ?? { watch: ["INBOX"], mode: "predefined" as const };
    const stateConfig = config.state ?? { audit_subjects: false };

    const existingFolders =
      foldersConfig.mode === "auto_create"
        ? await imapClient.listFolders()
        : undefined;

    const basePrompt = loadPrompt(config, account.name);
    const truncatedBody = truncateToTokens(email.body, provider.max_body_tokens);

    const emailContext: EmailContext = {
      from: email.from,
      subject: email.subject,
      date: email.date,
      body: truncatedBody,
      attachmentNames: email.attachments.map((a) => a.filename),
    };

    const promptOptions: PromptOptions = {
      basePrompt,
      folderMode: foldersConfig.mode,
    };

    if (foldersConfig.allowed) {
      promptOptions.allowedFolders = foldersConfig.allowed;
    }
    if (existingFolders) {
      promptOptions.existingFolders = existingFolders;
    }

    const prompt = buildPrompt(emailContext, promptOptions);

    log.debug("Classifying email", { messageId, promptLength: prompt.length });

    const actions = await classifyEmail({
      provider,
      model,
      prompt,
    });

    log.info("Classification complete", {
      messageId,
      actions: actions.map((a) => a.type),
    });

    if (!config.dry_run) {
      await executeActions(ctx, folder, uid, actions);
    } else {
      log.info("Dry run - skipping action execution", { messageId, actions });
    }

    markMessageProcessed(messageId, account.name);

    const subject = stateConfig.audit_subjects ? email.subject : undefined;
    logAction(messageId, account.name, actions, provider.name, model, subject);

    return true;
  } catch (error) {
    log.error("Failed to process message", {
      messageId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function executeActions(
  ctx: WorkerContext,
  folder: string,
  uid: number,
  actions: LlmAction[]
): Promise<void> {
  const { account, imapClient } = ctx;

  for (const action of actions) {
    await executeAction({
      action,
      imapClient,
      folder,
      uid,
      accountConfig: account,
    });
  }
}
