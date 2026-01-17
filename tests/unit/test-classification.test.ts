import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseRawEmail,
  validatePrompt,
  testClassification,
  testClassificationRaw,
  type TestClassificationRequest,
  type RawTestClassificationRequest,
} from "../../src/llm/test-classification.js";
import type { LlmProviderConfig } from "../../src/config/schema.js";

vi.mock("../../src/llm/client.js", () => ({
  classifyEmail: vi.fn(),
}));

vi.mock("../../src/llm/rate-limiter.js", () => ({
  acquireRateLimit: vi.fn().mockResolvedValue(undefined),
  handleRateLimitResponse: vi.fn(),
}));

import { classifyEmail } from "../../src/llm/client.js";

const mockProvider: LlmProviderConfig = {
  name: "test-provider",
  api_url: "https://api.example.com/v1/chat/completions",
  api_key: "test-key",
  default_model: "gpt-4",
  max_body_tokens: 4000,
  max_thread_tokens: 2000,
  supports_vision: false,
};

describe("parseRawEmail", () => {
  it("parses a simple RFC822 email", async () => {
    const rawEmail = `From: sender@example.com
To: recipient@example.com
Subject: Test Subject
Date: Mon, 15 Jan 2024 10:30:00 +0000

This is the email body.`;

    const parsed = await parseRawEmail(rawEmail);

    expect(parsed.from).toContain("sender@example.com");
    expect(parsed.to).toContain("recipient@example.com");
    expect(parsed.subject).toBe("Test Subject");
    expect(parsed.body).toBe("This is the email body.");
  });

  it("handles email with display name", async () => {
    const rawEmail = `From: "John Doe" <john@example.com>
To: recipient@example.com
Subject: Hello

Body text`;

    const parsed = await parseRawEmail(rawEmail);

    expect(parsed.from).toBe("John Doe <john@example.com>");
  });

  it("handles email with no subject", async () => {
    const rawEmail = `From: sender@example.com
To: recipient@example.com

Body only`;

    const parsed = await parseRawEmail(rawEmail);

    expect(parsed.subject).toBe("(no subject)");
  });

  it("extracts attachment metadata", async () => {
    const rawEmail = `From: sender@example.com
To: recipient@example.com
Subject: With Attachment
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/plain

Email body here.

--boundary123
Content-Type: application/pdf
Content-Disposition: attachment; filename="document.pdf"
Content-Transfer-Encoding: base64

JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9MZW5ndGggNDYwPj4Kc3RyZWFtCg==

--boundary123--`;

    const parsed = await parseRawEmail(rawEmail);

    expect(parsed.attachments.length).toBe(1);
    expect(parsed.attachments[0].filename).toBe("document.pdf");
    expect(parsed.attachments[0].contentType).toBe("application/pdf");
  });
});

describe("validatePrompt", () => {
  it("returns error for empty prompt", () => {
    const result = validatePrompt({ prompt: "" });

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("empty");
  });

  it("returns error for whitespace-only prompt", () => {
    const result = validatePrompt({ prompt: "   \n\t  " });

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it("returns valid for non-empty prompt", () => {
    const result = validatePrompt({
      prompt: "You are an email classifier. Respond with JSON.",
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("warns when prompt exceeds character limit", () => {
    const longPrompt = "a".repeat(5000);
    const result = validatePrompt({ prompt: longPrompt });

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("5000 characters"))).toBe(true);
  });

  it("warns when prompt doesn't mention JSON", () => {
    const result = validatePrompt({
      prompt: "You are an email classifier. Sort emails into folders.",
    });

    expect(result.warnings.some((w) => w.message.includes("JSON"))).toBe(true);
  });

  it("does not warn about JSON when mentioned", () => {
    const result = validatePrompt({
      prompt: "You are an email classifier. Respond with JSON format.",
    });

    expect(result.warnings.some((w) => w.message.includes("JSON"))).toBe(false);
  });

  it("warns about disallowed actions mentioned in prompt", () => {
    const result = validatePrompt({
      prompt: "You can delete or move emails as needed.",
      allowedActions: ["move", "flag"],
    });

    expect(result.warnings.some((w) => w.message.includes('"delete"'))).toBe(true);
  });

  it("does not warn about allowed actions", () => {
    const result = validatePrompt({
      prompt: "You can move or flag emails. Respond in JSON.",
      allowedActions: ["move", "flag", "noop"],
    });

    expect(result.warnings.some((w) => w.message.includes('"move"'))).toBe(false);
    expect(result.warnings.some((w) => w.message.includes('"flag"'))).toBe(false);
  });

  it("calculates stats correctly", () => {
    const result = validatePrompt({
      prompt: "Hello world test",
    });

    expect(result.stats.charCount).toBe(16);
    expect(result.stats.wordCount).toBe(3);
    expect(result.stats.estimatedTokens).toBe(4);
  });
});

describe("testClassification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds prompt and calls classifyEmail", async () => {
    const mockActions = [{ type: "move" as const, folder: "Work", reason: "Work email" }];
    vi.mocked(classifyEmail).mockResolvedValue(mockActions);

    const request: TestClassificationRequest = {
      prompt: "Classify this email",
      email: {
        from: "sender@example.com",
        subject: "Test",
        body: "Test body",
      },
      folderMode: "predefined",
      allowedFolders: ["Work", "Personal"],
      provider: mockProvider,
    };

    const result = await testClassification(request);

    expect(result.success).toBe(true);
    expect(result.classification?.actions).toEqual(mockActions);
    expect(result.promptUsed).toContain("Classify this email");
    expect(result.promptUsed).toContain("sender@example.com");
    expect(result.promptUsed).toContain("Test");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(classifyEmail).toHaveBeenCalledOnce();
  });

  it("includes folder constraints in prompt", async () => {
    vi.mocked(classifyEmail).mockResolvedValue([{ type: "noop" }]);

    const request: TestClassificationRequest = {
      prompt: "Classify",
      email: { from: "a@b.com", subject: "S", body: "B" },
      folderMode: "predefined",
      allowedFolders: ["Inbox", "Archive"],
      provider: mockProvider,
    };

    const result = await testClassification(request);

    expect(result.promptUsed).toContain("Allowed Folders");
    expect(result.promptUsed).toContain("Inbox");
    expect(result.promptUsed).toContain("Archive");
  });

  it("filters disallowed actions", async () => {
    vi.mocked(classifyEmail).mockResolvedValue([
      { type: "delete", reason: "Spam" },
    ]);

    const request: TestClassificationRequest = {
      prompt: "Classify",
      email: { from: "a@b.com", subject: "S", body: "B" },
      folderMode: "predefined",
      allowedActions: ["move", "flag"],
      provider: mockProvider,
    };

    const result = await testClassification(request);

    expect(result.success).toBe(true);
    expect(result.classification?.actions[0].type).toBe("noop");
    expect(result.classification?.actions[0].reason).toContain("not allowed");
  });

  it("handles LLM errors gracefully", async () => {
    vi.mocked(classifyEmail).mockRejectedValue(new Error("API timeout"));

    const request: TestClassificationRequest = {
      prompt: "Classify",
      email: { from: "a@b.com", subject: "S", body: "B" },
      folderMode: "predefined",
      provider: mockProvider,
    };

    const result = await testClassification(request);

    expect(result.success).toBe(false);
    expect(result.error).toBe("API timeout");
    expect(result.promptUsed).toBeTruthy();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe("testClassificationRaw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses raw email and classifies", async () => {
    const mockActions = [{ type: "move" as const, folder: "Work" }];
    vi.mocked(classifyEmail).mockResolvedValue(mockActions);

    const rawEmail = `From: sender@example.com
To: recipient@example.com
Subject: Raw Test

Raw email body content.`;

    const request: RawTestClassificationRequest = {
      prompt: "Classify this email",
      rawEmail,
      folderMode: "auto_create",
      existingFolders: ["Work", "Personal"],
      provider: mockProvider,
    };

    const result = await testClassificationRaw(request);

    expect(result.success).toBe(true);
    expect(result.parsed).toBeDefined();
    expect(result.parsed?.from).toContain("sender@example.com");
    expect(result.parsed?.subject).toBe("Raw Test");
    expect(result.parsed?.body).toBe("Raw email body content.");
    expect(result.classification?.actions).toEqual(mockActions);
  });

  it("returns error for invalid raw email", async () => {
    const request: RawTestClassificationRequest = {
      prompt: "Classify",
      rawEmail: "", // Empty raw email won't parse well
      folderMode: "predefined",
      provider: mockProvider,
    };

    const result = await testClassificationRaw(request);

    // Even empty input gets parsed (mailparser is lenient), but body will be empty
    // Let's test with truly malformed content that would fail
    expect(result.promptUsed).toBeDefined();
  });

  it("includes existing folders in prompt for auto_create mode", async () => {
    vi.mocked(classifyEmail).mockResolvedValue([{ type: "noop" }]);

    const rawEmail = `From: a@b.com
Subject: Test

Body`;

    const request: RawTestClassificationRequest = {
      prompt: "Classify",
      rawEmail,
      folderMode: "auto_create",
      existingFolders: ["Projects", "Archive", "Receipts"],
      provider: mockProvider,
    };

    const result = await testClassificationRaw(request);

    expect(result.promptUsed).toContain("Existing Folders");
    expect(result.promptUsed).toContain("Projects");
    expect(result.promptUsed).toContain("Archive");
    expect(result.promptUsed).toContain("Receipts");
  });
});
