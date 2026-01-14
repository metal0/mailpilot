import type { AttachmentsConfig } from "../config/schema.js";
import { createLogger } from "../utils/logger.js";
import { parseDuration } from "../utils/duration.js";

const logger = createLogger("tika");

export interface ExtractionResult {
  text: string;
  contentType: string;
  truncated: boolean;
  error?: string;
}

export interface TikaClient {
  extractText(data: Buffer, filename: string): Promise<ExtractionResult>;
  detectType(data: Buffer): Promise<string>;
  isHealthy(): Promise<boolean>;
}

export function createTikaClient(config: AttachmentsConfig): TikaClient {
  const baseUrl = config.tika_url ?? "http://localhost:9998";
  const timeout = parseDuration(config.timeout);
  const maxChars = config.max_extracted_chars;

  return {
    async extractText(data: Buffer, filename: string): Promise<ExtractionResult> {
      logger.debug("Extracting text from attachment", {
        filename,
        size: data.length,
      });

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => { controller.abort(); }, timeout);

        const response = await fetch(`${baseUrl}/tika`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/octet-stream",
            "Accept": "text/plain",
            "X-Tika-OCRskipOcr": "false",
          },
          body: data,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          logger.error("Tika extraction failed", {
            filename,
            status: response.status,
            error: errorText,
          });
          return {
            text: "",
            contentType: "unknown",
            truncated: false,
            error: `Tika returned ${response.status}: ${errorText}`,
          };
        }

        let text = await response.text();
        const contentType = response.headers.get("X-TIKA-Detected-Content-Type") ?? "unknown";
        let truncated = false;

        if (text.length > maxChars) {
          text = truncateAtWordBoundary(text, maxChars);
          truncated = true;
          logger.debug("Truncated extracted text", {
            filename,
            originalLength: text.length,
            truncatedTo: maxChars,
          });
        }

        logger.debug("Text extraction complete", {
          filename,
          contentType,
          textLength: text.length,
          truncated,
        });

        return { text: text.trim(), contentType, truncated };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isTimeout = message.includes("aborted") || message.includes("timeout");

        logger.error("Tika extraction error", {
          filename,
          error: message,
          isTimeout,
        });

        return {
          text: "",
          contentType: "unknown",
          truncated: false,
          error: isTimeout ? `Extraction timeout after ${timeout}ms` : message,
        };
      }
    },

    async detectType(data: Buffer): Promise<string> {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => { controller.abort(); }, 5000);

        const response = await fetch(`${baseUrl}/detect/stream`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/octet-stream",
          },
          body: data,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return "application/octet-stream";
        }

        return (await response.text()).trim();
      } catch {
        return "application/octet-stream";
      }
    },

    async isHealthy(): Promise<boolean> {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => { controller.abort(); }, 5000);

        const response = await fetch(`${baseUrl}/tika`, {
          method: "GET",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        return response.ok;
      } catch {
        return false;
      }
    },
  };
}

function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + "\n\n[Content truncated...]";
  }

  return truncated + "\n\n[Content truncated...]";
}
