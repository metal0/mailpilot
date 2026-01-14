import type { ImapClient } from "../imap/client.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("action-folder");

const createdFolders = new Set<string>();

export async function ensureFolderExists(
  imapClient: ImapClient,
  folderName: string
): Promise<void> {
  const cacheKey = `${folderName}`;
  if (createdFolders.has(cacheKey)) {
    return;
  }

  await imapClient.createFolder(folderName);
  createdFolders.add(cacheKey);
}

export function clearFolderCache(): void {
  createdFolders.clear();
  logger.debug("Cleared folder cache");
}
