import type { ImapClient } from "../imap/client.js";
import type { AccountConfig } from "../config/schema.js";
import type { LlmAction } from "../llm/parser.js";
import { createLogger } from "../utils/logger.js";
import { moveToFolder } from "./move.js";
import { applyFlags } from "./flag.js";
import { markRead } from "./read.js";
import { ensureFolderExists } from "./folder.js";

const logger = createLogger("actions");

export interface ActionContext {
  action: LlmAction;
  imapClient: ImapClient;
  folder: string;
  uid: number;
  accountConfig: AccountConfig;
}

export async function executeAction(ctx: ActionContext): Promise<void> {
  const { action, imapClient, folder, uid, accountConfig } = ctx;

  logger.debug("Executing action", {
    type: action.type,
    uid,
    reason: action.reason,
  });

  switch (action.type) {
    case "move":
      if (!action.folder) {
        logger.warn("Move action missing folder, skipping", { uid });
        break;
      }

      const foldersConfig = accountConfig.folders;
      if (foldersConfig?.mode === "predefined") {
        if (foldersConfig.allowed && !foldersConfig.allowed.includes(action.folder)) {
          logger.warn("Target folder not in allowed list, skipping", {
            uid,
            folder: action.folder,
          });
          break;
        }
      }

      await ensureFolderExists(imapClient, action.folder);
      await moveToFolder(imapClient, folder, uid, action.folder);
      break;

    case "spam":
      await imapClient.markAsSpam(uid, folder);
      break;

    case "flag":
      if (!action.flags || action.flags.length === 0) {
        logger.warn("Flag action missing flags, skipping", { uid });
        break;
      }
      await applyFlags(imapClient, folder, uid, action.flags);
      break;

    case "read":
      await markRead(imapClient, folder, uid);
      break;

    case "delete":
      await imapClient.deleteMessage(uid, folder);
      logger.info("Deleted message", { uid });
      break;

    case "noop":
      logger.debug("No action taken", { uid, reason: action.reason });
      break;

    default:
      logger.warn("Unknown action type", { type: action.type, uid });
  }
}
