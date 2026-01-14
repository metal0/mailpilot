import type { AttachmentsConfig } from "../config/schema.js";
import type { AttachmentInfo } from "../processor/email.js";
import { createTikaClient, type TikaClient } from "./tika.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("attachments");

export interface ExtractedAttachment {
  filename: string;
  contentType: string;
  size: number;
  text: string | null;
  imageBase64: string | null;
  error: string | null;
  truncated: boolean;
}

export interface AttachmentProcessor {
  extract(attachments: AttachmentInfo[]): Promise<ExtractedAttachment[]>;
  isHealthy(): Promise<boolean>;
}

const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

export function createAttachmentProcessor(
  config: AttachmentsConfig
): AttachmentProcessor {
  const tikaClient = createTikaClient(config);
  const maxSizeBytes = config.max_size_mb * 1024 * 1024;
  const allowedTypes = new Set(config.allowed_types);
  const extractImages = config.extract_images;

  return {
    async extract(attachments: AttachmentInfo[]): Promise<ExtractedAttachment[]> {
      const results: ExtractedAttachment[] = [];

      for (const att of attachments) {
        const result = await extractOne(
          att,
          tikaClient,
          maxSizeBytes,
          allowedTypes,
          extractImages
        );
        if (result) {
          results.push(result);
        }
      }

      return results;
    },

    async isHealthy(): Promise<boolean> {
      return tikaClient.isHealthy();
    },
  };
}

async function extractOne(
  attachment: AttachmentInfo,
  tika: TikaClient,
  maxSizeBytes: number,
  allowedTypes: Set<string>,
  extractImages: boolean
): Promise<ExtractedAttachment | null> {
  const { filename, contentType, size, content } = attachment;

  // Skip if no content
  if (!content) {
    logger.debug("Skipping attachment without content", { filename });
    return null;
  }

  // Check size limit
  if (size > maxSizeBytes) {
    logger.debug("Skipping attachment exceeding size limit", {
      filename,
      size,
      maxSizeBytes,
    });
    return {
      filename,
      contentType,
      size,
      text: null,
      imageBase64: null,
      error: `Exceeds size limit (${(size / 1024 / 1024).toFixed(1)}MB > ${maxSizeBytes / 1024 / 1024}MB)`,
      truncated: false,
    };
  }

  // Check allowed types
  if (!isAllowedType(contentType, allowedTypes)) {
    logger.debug("Skipping attachment with disallowed type", {
      filename,
      contentType,
    });
    return null;
  }

  const isImage = IMAGE_TYPES.includes(contentType);

  // For images with extractImages enabled, include base64
  let imageBase64: string | null = null;
  if (isImage && extractImages) {
    imageBase64 = content.toString("base64");
  }

  // Extract text via Tika
  let text: string | null = null;
  let error: string | null = null;
  let truncated = false;

  // For plain text, read directly without Tika
  if (contentType === "text/plain" || contentType === "text/csv") {
    text = content.toString("utf-8");
    logger.debug("Read text attachment directly", { filename, length: text.length });
  } else {
    // Use Tika for other types
    const result = await tika.extractText(content, filename);
    text = result.text || null;
    error = result.error || null;
    truncated = result.truncated;
  }

  return {
    filename,
    contentType,
    size,
    text,
    imageBase64,
    error,
    truncated,
  };
}

function isAllowedType(contentType: string, allowedTypes: Set<string>): boolean {
  // Direct match
  if (allowedTypes.has(contentType)) {
    return true;
  }

  // Check for wildcard matches (e.g., "image/*")
  const [category] = contentType.split("/");
  if (allowedTypes.has(`${category}/*`)) {
    return true;
  }

  // Check for common variations
  if (contentType === "image/jpg" && allowedTypes.has("image/jpeg")) {
    return true;
  }

  return false;
}

export function formatAttachmentsForPrompt(
  attachments: ExtractedAttachment[]
): string {
  if (attachments.length === 0) {
    return "";
  }

  const lines: string[] = ["", "## Attachments", ""];

  for (const att of attachments) {
    const sizeStr = formatSize(att.size);
    lines.push(`### ${att.filename} (${att.contentType}, ${sizeStr})`);

    if (att.error) {
      lines.push(`[Extraction failed: ${att.error}]`);
    } else if (att.text) {
      if (att.truncated) {
        lines.push("[Extracted text, truncated]");
      }
      lines.push("```");
      lines.push(att.text);
      lines.push("```");
    } else if (att.imageBase64) {
      lines.push("[Image attachment - will be included for vision-capable models]");
    } else {
      lines.push("[No text content extracted]");
    }

    lines.push("");
  }

  return lines.join("\n");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export interface MultimodalContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
  };
}

export function buildMultimodalContent(
  textPrompt: string,
  attachments: ExtractedAttachment[]
): MultimodalContent[] {
  const content: MultimodalContent[] = [
    { type: "text", text: textPrompt },
  ];

  for (const att of attachments) {
    if (att.imageBase64) {
      content.push({
        type: "image_url",
        image_url: {
          url: `data:${att.contentType};base64,${att.imageBase64}`,
        },
      });
    }
  }

  return content;
}

export function hasImages(attachments: ExtractedAttachment[]): boolean {
  return attachments.some((att) => att.imageBase64 !== null);
}
