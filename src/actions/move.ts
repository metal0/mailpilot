import type { ImapClient } from "../imap/client.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("action-move");

export async function moveToFolder(
  imapClient: ImapClient,
  sourceFolder: string,
  uid: number,
  targetFolder: string
): Promise<void> {
  await imapClient.moveMessage(uid, sourceFolder, targetFolder);
  logger.info("Moved message", { uid, from: sourceFolder, to: targetFolder });
}
