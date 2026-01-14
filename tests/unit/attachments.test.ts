import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createAttachmentProcessor,
  formatAttachmentsForPrompt,
  buildMultimodalContent,
  hasImages,
  type ExtractedAttachment,
} from "../../src/attachments/processor.js";
import type { AttachmentsConfig } from "../../src/config/schema.js";
import type { AttachmentInfo } from "../../src/processor/email.js";

const mockConfig: AttachmentsConfig = {
  enabled: true,
  timeout: "30s",
  max_size_mb: 10,
  max_extracted_chars: 10000,
  allowed_types: [
    "application/pdf",
    "text/plain",
    "text/csv",
    "image/png",
    "image/jpeg",
  ],
  extract_images: true,
  tika_url: "http://localhost:9998",
};

describe("formatAttachmentsForPrompt", () => {
  it("returns empty string for empty attachments", () => {
    const result = formatAttachmentsForPrompt([]);
    expect(result).toBe("");
  });

  it("formats text attachment correctly", () => {
    const attachments: ExtractedAttachment[] = [
      {
        filename: "document.pdf",
        contentType: "application/pdf",
        size: 1024,
        text: "Document content here",
        imageBase64: null,
        error: null,
        truncated: false,
      },
    ];

    const result = formatAttachmentsForPrompt(attachments);

    expect(result).toContain("## Attachments");
    expect(result).toContain("### document.pdf");
    expect(result).toContain("application/pdf");
    expect(result).toContain("1.0 KB");
    expect(result).toContain("```");
    expect(result).toContain("Document content here");
  });

  it("formats truncated attachment with indicator", () => {
    const attachments: ExtractedAttachment[] = [
      {
        filename: "large.pdf",
        contentType: "application/pdf",
        size: 1024 * 1024,
        text: "Truncated content...",
        imageBase64: null,
        error: null,
        truncated: true,
      },
    ];

    const result = formatAttachmentsForPrompt(attachments);

    expect(result).toContain("[Extracted text, truncated]");
    expect(result).toContain("1.0 MB");
  });

  it("formats image attachment correctly", () => {
    const attachments: ExtractedAttachment[] = [
      {
        filename: "image.png",
        contentType: "image/png",
        size: 512,
        text: null,
        imageBase64: "base64data",
        error: null,
        truncated: false,
      },
    ];

    const result = formatAttachmentsForPrompt(attachments);

    expect(result).toContain("### image.png");
    expect(result).toContain("512 B");
    expect(result).toContain("[Image attachment - will be included for vision-capable models]");
  });

  it("formats attachment with extraction error", () => {
    const attachments: ExtractedAttachment[] = [
      {
        filename: "broken.pdf",
        contentType: "application/pdf",
        size: 2048,
        text: null,
        imageBase64: null,
        error: "Extraction failed: corrupt file",
        truncated: false,
      },
    ];

    const result = formatAttachmentsForPrompt(attachments);

    expect(result).toContain("[Extraction failed: Extraction failed: corrupt file]");
  });

  it("formats attachment with no extracted content", () => {
    const attachments: ExtractedAttachment[] = [
      {
        filename: "empty.pdf",
        contentType: "application/pdf",
        size: 100,
        text: null,
        imageBase64: null,
        error: null,
        truncated: false,
      },
    ];

    const result = formatAttachmentsForPrompt(attachments);

    expect(result).toContain("[No text content extracted]");
  });

  it("formats multiple attachments", () => {
    const attachments: ExtractedAttachment[] = [
      {
        filename: "doc1.pdf",
        contentType: "application/pdf",
        size: 1024,
        text: "First document",
        imageBase64: null,
        error: null,
        truncated: false,
      },
      {
        filename: "doc2.txt",
        contentType: "text/plain",
        size: 512,
        text: "Second document",
        imageBase64: null,
        error: null,
        truncated: false,
      },
    ];

    const result = formatAttachmentsForPrompt(attachments);

    expect(result).toContain("doc1.pdf");
    expect(result).toContain("doc2.txt");
    expect(result).toContain("First document");
    expect(result).toContain("Second document");
  });
});

describe("buildMultimodalContent", () => {
  it("builds content with text only when no images", () => {
    const attachments: ExtractedAttachment[] = [
      {
        filename: "doc.pdf",
        contentType: "application/pdf",
        size: 1024,
        text: "Document text",
        imageBase64: null,
        error: null,
        truncated: false,
      },
    ];

    const result = buildMultimodalContent("Prompt text", attachments);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "text", text: "Prompt text" });
  });

  it("builds content with images", () => {
    const attachments: ExtractedAttachment[] = [
      {
        filename: "image.png",
        contentType: "image/png",
        size: 1024,
        text: null,
        imageBase64: "base64data",
        error: null,
        truncated: false,
      },
    ];

    const result = buildMultimodalContent("Prompt text", attachments);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: "text", text: "Prompt text" });
    expect(result[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,base64data" },
    });
  });

  it("builds content with multiple images", () => {
    const attachments: ExtractedAttachment[] = [
      {
        filename: "image1.png",
        contentType: "image/png",
        size: 1024,
        text: null,
        imageBase64: "base64data1",
        error: null,
        truncated: false,
      },
      {
        filename: "image2.jpeg",
        contentType: "image/jpeg",
        size: 2048,
        text: null,
        imageBase64: "base64data2",
        error: null,
        truncated: false,
      },
    ];

    const result = buildMultimodalContent("Prompt text", attachments);

    expect(result).toHaveLength(3);
    expect(result[1].image_url?.url).toContain("image/png");
    expect(result[2].image_url?.url).toContain("image/jpeg");
  });

  it("filters out attachments without imageBase64", () => {
    const attachments: ExtractedAttachment[] = [
      {
        filename: "doc.pdf",
        contentType: "application/pdf",
        size: 1024,
        text: "Text content",
        imageBase64: null,
        error: null,
        truncated: false,
      },
      {
        filename: "image.png",
        contentType: "image/png",
        size: 1024,
        text: null,
        imageBase64: "base64data",
        error: null,
        truncated: false,
      },
    ];

    const result = buildMultimodalContent("Prompt text", attachments);

    expect(result).toHaveLength(2);
    expect(result[1].image_url?.url).toContain("image/png");
  });
});

describe("hasImages", () => {
  it("returns false for empty array", () => {
    expect(hasImages([])).toBe(false);
  });

  it("returns false when no attachments have images", () => {
    const attachments: ExtractedAttachment[] = [
      {
        filename: "doc.pdf",
        contentType: "application/pdf",
        size: 1024,
        text: "Text content",
        imageBase64: null,
        error: null,
        truncated: false,
      },
    ];

    expect(hasImages(attachments)).toBe(false);
  });

  it("returns true when at least one attachment has image", () => {
    const attachments: ExtractedAttachment[] = [
      {
        filename: "doc.pdf",
        contentType: "application/pdf",
        size: 1024,
        text: "Text content",
        imageBase64: null,
        error: null,
        truncated: false,
      },
      {
        filename: "image.png",
        contentType: "image/png",
        size: 512,
        text: null,
        imageBase64: "base64data",
        error: null,
        truncated: false,
      },
    ];

    expect(hasImages(attachments)).toBe(true);
  });
});

describe("createAttachmentProcessor", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("extract", () => {
    it("skips attachments without content", async () => {
      const processor = createAttachmentProcessor(mockConfig);
      const attachments: AttachmentInfo[] = [
        {
          filename: "doc.pdf",
          contentType: "application/pdf",
          size: 1024,
          content: undefined,
        },
      ];

      const result = await processor.extract(attachments);

      expect(result).toHaveLength(0);
    });

    it("skips attachments exceeding size limit", async () => {
      const processor = createAttachmentProcessor(mockConfig);
      const attachments: AttachmentInfo[] = [
        {
          filename: "large.pdf",
          contentType: "application/pdf",
          size: 20 * 1024 * 1024, // 20 MB
          content: Buffer.from("test"),
        },
      ];

      const result = await processor.extract(attachments);

      expect(result).toHaveLength(1);
      expect(result[0].error).toContain("Exceeds size limit");
    });

    it("skips disallowed content types", async () => {
      const processor = createAttachmentProcessor(mockConfig);
      const attachments: AttachmentInfo[] = [
        {
          filename: "script.exe",
          contentType: "application/x-executable",
          size: 1024,
          content: Buffer.from("test"),
        },
      ];

      const result = await processor.extract(attachments);

      expect(result).toHaveLength(0);
    });

    it("extracts text from plain text files directly", async () => {
      const processor = createAttachmentProcessor(mockConfig);
      const attachments: AttachmentInfo[] = [
        {
          filename: "readme.txt",
          contentType: "text/plain",
          size: 11,
          content: Buffer.from("Hello world"),
        },
      ];

      const result = await processor.extract(attachments);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Hello world");
      expect(result[0].filename).toBe("readme.txt");
    });

    it("extracts text from CSV files directly", async () => {
      const processor = createAttachmentProcessor(mockConfig);
      const csvContent = "name,value\ntest,123";
      const attachments: AttachmentInfo[] = [
        {
          filename: "data.csv",
          contentType: "text/csv",
          size: csvContent.length,
          content: Buffer.from(csvContent),
        },
      ];

      const result = await processor.extract(attachments);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe(csvContent);
    });

    it("extracts base64 from images when extract_images enabled", async () => {
      const processor = createAttachmentProcessor(mockConfig);
      const imageContent = Buffer.from("fake png data");
      const attachments: AttachmentInfo[] = [
        {
          filename: "photo.png",
          contentType: "image/png",
          size: imageContent.length,
          content: imageContent,
        },
      ];

      // Mock Tika for non-text extraction
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
        headers: { get: () => "image/png" },
      });

      const result = await processor.extract(attachments);

      expect(result).toHaveLength(1);
      expect(result[0].imageBase64).toBe(imageContent.toString("base64"));
    });

    it("uses Tika for PDF extraction", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("Extracted PDF content"),
        headers: { get: () => "application/pdf" },
      });

      const processor = createAttachmentProcessor(mockConfig);
      const attachments: AttachmentInfo[] = [
        {
          filename: "document.pdf",
          contentType: "application/pdf",
          size: 1024,
          content: Buffer.from("PDF content"),
        },
      ];

      const result = await processor.extract(attachments);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Extracted PDF content");
      expect(global.fetch).toHaveBeenCalled();
    });

    it("handles Tika extraction errors gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal error"),
      });

      const processor = createAttachmentProcessor(mockConfig);
      const attachments: AttachmentInfo[] = [
        {
          filename: "document.pdf",
          contentType: "application/pdf",
          size: 1024,
          content: Buffer.from("PDF content"),
        },
      ];

      const result = await processor.extract(attachments);

      expect(result).toHaveLength(1);
      expect(result[0].error).toContain("500");
    });

    it("handles image/jpg as allowed when image/jpeg is allowed", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
        headers: { get: () => "image/jpg" },
      });

      const processor = createAttachmentProcessor(mockConfig);
      const attachments: AttachmentInfo[] = [
        {
          filename: "photo.jpg",
          contentType: "image/jpg",
          size: 1024,
          content: Buffer.from("fake jpg data"),
        },
      ];

      const result = await processor.extract(attachments);

      expect(result).toHaveLength(1);
    });
  });

  describe("isHealthy", () => {
    it("delegates to Tika client health check", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      const processor = createAttachmentProcessor(mockConfig);
      const result = await processor.isHealthy();

      expect(result).toBe(true);
    });

    it("returns false when Tika is unavailable", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const processor = createAttachmentProcessor(mockConfig);
      const result = await processor.isHealthy();

      expect(result).toBe(false);
    });
  });
});
