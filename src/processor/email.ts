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
}

export async function fetchAndParseEmail(
  client: ImapFlow,
  folder: string,
  uid: number
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

    return transformParsedMail(parsed, uid);
  } finally {
    lock.release();
  }
}

function transformParsedMail(parsed: ParsedMail, uid: number): ParsedEmail {
  const from = extractFrom(parsed);
  const subject = parsed.subject ?? "(no subject)";
  const date = parsed.date?.toISOString() ?? new Date().toISOString();
  const messageId = parsed.messageId ?? `uid-${uid}`;

  let body = "";
  if (parsed.text) {
    body = parsed.text;
  } else if (parsed.html) {
    body = stripHtml(parsed.html);
  }

  const attachments: AttachmentInfo[] = [];
  for (const att of parsed.attachments) {
    attachments.push({
      filename: att.filename ?? "unnamed",
      contentType: att.contentType,
      size: att.size,
    });
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

  if (parsed.html) {
    result.html = parsed.html;
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
