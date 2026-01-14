import type { ImapClient } from "../imap/client.js";
import type { AccountConfig, Config, LlmProviderConfig } from "../config/schema.js";
import { createLogger } from "../utils/logger.js";
import { isShutdownInProgress } from "../utils/shutdown.js";
import { isMessageProcessed, markMessageProcessed } from "../storage/processed.js";
import { logAction } from "../storage/audit.js";
import { fetchAndParseEmail, type ParsedEmail } from "./email.js";
import type { AntivirusScanner } from "./antivirus.js";
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
  antivirusScanner?: AntivirusScanner;
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
  const { account, imapClient, provider, model, config, antivirusScanner } = ctx;
  const log = logger.child(account.name);

  if (isMessageProcessed(messageId, account.name)) {
    log.debug("Message already processed", { messageId });
    return false;
  }

  try {
    const avConfig = config.antivirus;
    const needsAvScan = Boolean(antivirusScanner && avConfig?.enabled);

    const email = await fetchAndParseEmail(imapClient.client, folder, uid, {
      includeAttachmentContent: needsAvScan,
    });

    // Antivirus scanning
    if (needsAvScan && email.attachments.length > 0) {
      const avResult = await scanEmailAttachments(ctx, email, folder, uid);
      if (avResult === "skip") {
        markMessageProcessed(messageId, account.name);
        return true;
      }
    }

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

async function scanEmailAttachments(
  ctx: WorkerContext,
  email: ParsedEmail,
  folder: string,
  uid: number
): Promise<"continue" | "skip"> {
  const { config, imapClient, antivirusScanner, account } = ctx;
  const log = logger.child(account.name);
  const avConfig = config.antivirus;

  if (!antivirusScanner || !avConfig) {
    return "continue";
  }

  for (const attachment of email.attachments) {
    if (!attachment.content) {
      continue;
    }

    const result = await antivirusScanner.scan(attachment.content, attachment.filename);

    if (result.infected) {
      log.warn("Virus detected in attachment", {
        messageId: email.messageId,
        filename: attachment.filename,
        virus: result.virus,
        action: avConfig.on_virus_detected,
      });

      switch (avConfig.on_virus_detected) {
        case "quarantine":
          await imapClient.moveMessage(uid, folder, "Quarantine");
          log.info("Moved infected email to Quarantine", { messageId: email.messageId });
          return "skip";

        case "delete":
          await imapClient.deleteMessage(uid, folder);
          log.info("Deleted infected email", { messageId: email.messageId });
          return "skip";

        case "flag_only":
          await imapClient.flagMessage(uid, folder, ["$Virus", "\\Flagged"]);
          log.info("Flagged infected email", { messageId: email.messageId });
          return "continue";
      }
    }
  }

  return "continue";
}
