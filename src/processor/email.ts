import { simpleParser, type ParsedMail } from "mailparser";
import { ImapFlow } from "imapflow";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("email-processor");

export interface ParsedEmail {
  messageId: string;
  from: string;
  subject: string;
  date: string;
  body: string;
  html?: string;
  attachments: AttachmentInfo[];
}

export interface AttachmentInfo {
  filename: string;
  contentType: string;
  size: number;
  content?: Buffer;
}

export interface FetchOptions {
  includeAttachmentContent?: boolean;
}

export async function fetchAndParseEmail(
  client: ImapFlow,
  folder: string,
  uid: number,
  options: FetchOptions = {}
): Promise<ParsedEmail> {
  const lock = await client.getMailboxLock(folder);

  try {
    const message = await client.fetchOne(
      uid,
      { source: true, envelope: true },
      { uid: true }
    );

    if (!message) {
      throw new Error(`Failed to fetch message for UID ${uid}`);
    }

    if (!message.source) {
      throw new Error(`Failed to fetch message source for UID ${uid}`);
    }

    const parsed = await simpleParser(message.source);

    return transformParsedMail(parsed, uid, options);
  } finally {
    lock.release();
  }
}

function transformParsedMail(
  parsed: ParsedMail,
  uid: number,
  options: FetchOptions = {}
): ParsedEmail {
  const from = extractFrom(parsed);
  const subject = parsed.subject ?? "(no subject)";
  const date = parsed.date?.toISOString() ?? new Date().toISOString();
  const messageId = parsed.messageId ?? `uid-${uid}`;

  // Debug: Log MIME structure
  const textContent = typeof parsed.text === "string" ? parsed.text : "";
  const htmlContent = typeof parsed.html === "string" ? parsed.html : "";

  logger.debug("MIME structure", {
    messageId,
    hasText: textContent.length > 0,
    textLength: textContent.length,
    hasHtml: htmlContent.length > 0,
    htmlLength: htmlContent.length,
    attachmentCount: parsed.attachments.length,
    attachmentTypes: parsed.attachments.map(a => ({
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
    })),
  });

  let body = "";
  if (textContent) {
    body = textContent;
  } else if (htmlContent) {
    body = stripHtml(htmlContent);
  }

  // If body is still empty, try to extract from text/plain attachments
  if (!body) {
    for (const att of parsed.attachments) {
      if (att.contentType === "text/plain") {
        const attText = Buffer.isBuffer(att.content)
          ? att.content.toString("utf-8")
          : String(att.content);
        if (attText) {
          logger.debug("Extracted body from text/plain attachment", {
            filename: att.filename,
            size: att.size,
          });
          body = attText;
          break;
        }
      }
    }
  }

  const attachments: AttachmentInfo[] = [];
  for (const att of parsed.attachments) {
    const info: AttachmentInfo = {
      filename: att.filename ?? "unnamed",
      contentType: att.contentType,
      size: att.size,
    };

    if (options.includeAttachmentContent) {
      info.content = Buffer.isBuffer(att.content)
        ? att.content
        : Buffer.from(att.content);
    }

    attachments.push(info);
  }

  logger.debug("Parsed email", {
    messageId,
    from,
    subject,
    bodyLength: body.length,
    attachmentCount: attachments.length,
  });

  const result: ParsedEmail = {
    messageId,
    from,
    subject,
    date,
    body,
    attachments,
  };

  if (htmlContent) {
    result.html = htmlContent;
  }

  return result;
}

function extractFrom(parsed: ParsedMail): string {
  const firstAddr = parsed.from?.value[0];
  if (firstAddr) {
    if (firstAddr.address && firstAddr.name) {
      return `${firstAddr.name} <${firstAddr.address}>`;
    }
    if (firstAddr.address) {
      return firstAddr.address;
    }
    if (firstAddr.name) {
      return firstAddr.name;
    }
  }
  return "unknown";
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detects if an email is PGP encrypted.
 * Checks for:
 * - multipart/encrypted content type with pgp protocol
 * - application/pgp-encrypted attachments
 * - PGP message markers in body
 */
export function isPgpEncrypted(parsed: ParsedMail): boolean {
  const contentType = parsed.headers.get("content-type");

  // Check for multipart/encrypted with PGP protocol
  if (contentType) {
    // Content-Type header can be a string or structured object
    const ctValue = typeof contentType === "string"
      ? contentType
      : JSON.stringify(contentType);
    if (
      ctValue.includes("multipart/encrypted") &&
      ctValue.includes("application/pgp-encrypted")
    ) {
      return true;
    }
  }

  // Check for PGP-encrypted attachments
  for (const att of parsed.attachments) {
    if (
      att.contentType === "application/pgp-encrypted" ||
      att.contentType === "application/octet-stream" &&
        att.filename?.endsWith(".gpg")
    ) {
      return true;
    }
  }

  // Check body for PGP message markers
  const body = typeof parsed.text === "string" ? parsed.text : "";
  if (
    body.includes("-----BEGIN PGP MESSAGE-----") ||
    body.includes("-----BEGIN PGP SIGNED MESSAGE-----")
  ) {
    return true;
  }

  return false;
}

export interface ParsedEmailWithPgp extends ParsedEmail {
  isPgpEncrypted: boolean;
}

export async function fetchAndParseEmailWithPgpDetection(
  client: ImapFlow,
  folder: string,
  uid: number,
  options: FetchOptions = {}
): Promise<ParsedEmailWithPgp> {
  const lock = await client.getMailboxLock(folder);

  try {
    const message = await client.fetchOne(
      uid,
      { source: true, envelope: true },
      { uid: true }
    );

    if (!message) {
      throw new Error(`Failed to fetch message for UID ${uid}`);
    }

    if (!message.source) {
      throw new Error(`Failed to fetch message source for UID ${uid}`);
    }

    const parsed = await simpleParser(message.source);
    const pgpEncrypted = isPgpEncrypted(parsed);

    if (pgpEncrypted) {
      logger.info("Detected PGP encrypted email", {
        uid,
        subject: parsed.subject,
      });
    }

    const email = transformParsedMail(parsed, uid, options);
    return {
      ...email,
      isPgpEncrypted: pgpEncrypted,
    };
  } finally {
    lock.release();
  }
}
