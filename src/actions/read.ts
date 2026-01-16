import type { ImapClient } from "../imap/client.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("action-read");

export async function markRead(
  imapClient: ImapClient,
  folder: string,
  uid: number
): Promise<void> {
  await imapClient.markAsRead(uid, folder);
  logger.debug("Marked message as read", { uid });
}
