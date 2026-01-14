import type { ImapClient } from "../imap/client.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("action-flag");

export async function applyFlags(
  imapClient: ImapClient,
  folder: string,
  uid: number,
  flags: string[]
): Promise<void> {
  await imapClient.flagMessage(uid, folder, flags);
  logger.info("Applied flags", { uid, flags });
}
