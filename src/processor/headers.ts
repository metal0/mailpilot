import type { ImapClient } from "../imap/client.js";
import type { LlmAction } from "../llm/parser.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("headers");

export interface ProcessingMetadata {
  actions: LlmAction[];
  model: string;
  analysis?: string;
}

export interface AddHeadersResult {
  success: boolean;
  newUid?: number;
  error?: string;
}

/**
 * Detects if an email is PGP encrypted by examining the raw source.
 * Checks for:
 * - Content-Type: multipart/encrypted
 * - Content-Type: application/pgp-encrypted
 * - PGP message markers in body
 */
export function isPGPEncrypted(source: Buffer): boolean {
  const content = source.toString("utf-8", 0, Math.min(source.length, 8192));
  const contentLower = content.toLowerCase();

  // Check Content-Type headers
  if (
    contentLower.includes("multipart/encrypted") ||
    contentLower.includes("application/pgp-encrypted") ||
    contentLower.includes("application/pgp-signature")
  ) {
    return true;
  }

  // Check for PGP message markers
  if (content.includes("-----BEGIN PGP MESSAGE-----")) {
    return true;
  }

  return false;
}

/**
 * Formats actions for the X-Mailpilot-Actions header.
 * Example: "move:Archive, flag:Important"
 */
function formatActions(actions: LlmAction[]): string {
  return actions
    .map((a) => {
      switch (a.type) {
        case "move":
          return `move:${a.folder}`;
        case "flag":
          return `flag:${a.flags?.join("+")}`;
        case "read":
          return "read";
        case "delete":
          return "delete";
        case "spam":
          return "spam";
        case "noop":
          return `noop:${a.reason ?? "no action"}`;
        default:
          return "unknown";
      }
    })
    .join(", ");
}

/**
 * Injects custom headers into a raw email source.
 * Headers are inserted after the first line (or at the beginning if no headers exist).
 */
export function injectHeaders(
  source: Buffer,
  metadata: ProcessingMetadata
): Buffer {
  const sourceStr = source.toString("utf-8");

  // Find the end of the first header line (or beginning of headers section)
  const firstLineEnd = sourceStr.indexOf("\r\n");
  if (firstLineEnd === -1) {
    // Malformed email, return as-is
    return source;
  }

  const timestamp = new Date().toISOString();
  const actionsStr = formatActions(metadata.actions);

  // Build headers to inject
  const headers: string[] = [
    `X-Mailpilot-Processed: ${timestamp}`,
    `X-Mailpilot-Actions: ${actionsStr}`,
    `X-Mailpilot-Model: ${metadata.model}`,
  ];

  // Add analysis if provided (base64 encoded to avoid line length issues)
  if (metadata.analysis) {
    const analysisB64 = Buffer.from(metadata.analysis).toString("base64");
    headers.push(`X-Mailpilot-Analysis: ${analysisB64}`);
  }

  // Insert headers after the first line
  const before = sourceStr.slice(0, firstLineEnd + 2);
  const after = sourceStr.slice(firstLineEnd + 2);
  const injected = before + headers.join("\r\n") + "\r\n" + after;

  return Buffer.from(injected, "utf-8");
}

/**
 * Adds processing headers to an email message.
 *
 * This operation:
 * 1. Fetches the raw message source
 * 2. Checks if the message is PGP encrypted (skips if so)
 * 3. Injects custom X-Mailpilot-* headers
 * 4. Appends the modified message back to the folder
 * 5. Copies flags from the original message
 * 6. Deletes the original message
 *
 * Returns the new UID of the modified message.
 */
export async function addProcessingHeaders(
  imapClient: ImapClient,
  folder: string,
  uid: number,
  metadata: ProcessingMetadata
): Promise<AddHeadersResult> {
  const log = logger;

  try {
    // Fetch raw message source
    const source = await imapClient.fetchMessageSource(uid, folder);

    // Check for PGP encryption
    if (isPGPEncrypted(source)) {
      log.debug("Skipping header injection for PGP-encrypted message", { uid });
      return { success: true };
    }

    // Get original flags
    const flags = await imapClient.getMessageFlags(uid, folder);

    // Inject headers
    const modifiedSource = injectHeaders(source, metadata);

    // Append modified message
    const newUid = await imapClient.appendMessage(
      folder,
      modifiedSource,
      flags,
      undefined // preserve original internal date by not specifying
    );

    // Delete original message
    await imapClient.deleteMessage(uid, folder);

    log.debug("Added processing headers to message", {
      originalUid: uid,
      newUid,
      folder,
    });

    return { success: true, newUid };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Failed to add processing headers", {
      uid,
      folder,
      error: message,
    });
    return { success: false, error: message };
  }
}
