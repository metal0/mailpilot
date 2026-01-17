import { describe, it, expect } from "vitest";
import { buildPrompt, truncateToTokens, type EmailContext, type PromptOptions } from "../../src/llm/prompt.js";

describe("buildPrompt", () => {
  const baseEmail: EmailContext = {
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Test Email",
    date: "2026-01-14T12:00:00Z",
    body: "This is a test email body.",
  };

  const baseOptions: PromptOptions = {
    basePrompt: "You are an email classifier.",
    folderMode: "predefined",
  };

  describe("predefined mode with allowed folders", () => {
    it("includes allowed folders section when folders are specified", () => {
      const options: PromptOptions = {
        ...baseOptions,
        folderMode: "predefined",
        allowedFolders: ["Work", "Personal", "Finance"],
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).toContain("## Allowed Folders");
      expect(prompt).toContain("You may ONLY move emails to these folders:");
      expect(prompt).toContain("- Work");
      expect(prompt).toContain("- Personal");
      expect(prompt).toContain("- Finance");
    });

    it("excludes allowed folders section when no folders specified", () => {
      const options: PromptOptions = {
        ...baseOptions,
        folderMode: "predefined",
        allowedFolders: [],
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).not.toContain("## Allowed Folders");
    });

    it("excludes allowed folders section when allowedFolders is undefined", () => {
      const options: PromptOptions = {
        ...baseOptions,
        folderMode: "predefined",
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).not.toContain("## Allowed Folders");
    });
  });

  describe("predefined mode with auto-discovered folders", () => {
    it("uses discovered folders as allowed folders", () => {
      const discoveredFolders = ["INBOX", "Sent", "Drafts", "Archive", "Clients/Acme"];
      const options: PromptOptions = {
        ...baseOptions,
        folderMode: "predefined",
        allowedFolders: discoveredFolders,
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).toContain("## Allowed Folders");
      expect(prompt).toContain("- INBOX");
      expect(prompt).toContain("- Sent");
      expect(prompt).toContain("- Archive");
      expect(prompt).toContain("- Clients/Acme");
    });
  });

  describe("auto_create mode", () => {
    it("includes existing folders section when folders provided", () => {
      const options: PromptOptions = {
        ...baseOptions,
        folderMode: "auto_create",
        existingFolders: ["Work", "Personal"],
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).toContain("## Existing Folders");
      expect(prompt).toContain("Prefer using existing folders over creating new ones:");
      expect(prompt).toContain("- Work");
      expect(prompt).toContain("- Personal");
    });

    it("does not include existing folders when none provided", () => {
      const options: PromptOptions = {
        ...baseOptions,
        folderMode: "auto_create",
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).not.toContain("## Existing Folders");
    });

    it("does not use allowedFolders in auto_create mode", () => {
      const options: PromptOptions = {
        ...baseOptions,
        folderMode: "auto_create",
        allowedFolders: ["Work", "Personal"],
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).not.toContain("## Allowed Folders");
    });
  });

  describe("email context", () => {
    it("includes all email fields in prompt", () => {
      const prompt = buildPrompt(baseEmail, baseOptions);

      expect(prompt).toContain("**From:** sender@example.com");
      expect(prompt).toContain("**To:** recipient@example.com");
      expect(prompt).toContain("**Subject:** Test Email");
      expect(prompt).toContain("**Date:** 2026-01-14T12:00:00Z");
      expect(prompt).toContain("This is a test email body.");
    });

    it("includes recipient (to) field before subject", () => {
      const email: EmailContext = {
        ...baseEmail,
        to: "myaccount@company.com",
      };

      const prompt = buildPrompt(email, baseOptions);
      const fromIndex = prompt.indexOf("**From:**");
      const toIndex = prompt.indexOf("**To:**");
      const subjectIndex = prompt.indexOf("**Subject:**");

      expect(toIndex).toBeGreaterThan(fromIndex);
      expect(toIndex).toBeLessThan(subjectIndex);
    });

    it("includes attachment names when present", () => {
      const email: EmailContext = {
        ...baseEmail,
        attachmentNames: ["invoice.pdf", "receipt.png"],
      };

      const prompt = buildPrompt(email, baseOptions);

      expect(prompt).toContain("**Attachments:** invoice.pdf, receipt.png");
    });

    it("excludes attachments line when no attachments", () => {
      const prompt = buildPrompt(baseEmail, baseOptions);

      expect(prompt).not.toContain("**Attachments:**");
    });

    it("includes thread context when provided", () => {
      const email: EmailContext = {
        ...baseEmail,
        threadContext: "Previous message: Hello, how are you?",
      };

      const prompt = buildPrompt(email, baseOptions);

      expect(prompt).toContain("## Thread Context");
      expect(prompt).toContain("Previous message: Hello, how are you?");
    });
  });

  describe("base prompt", () => {
    it("includes base prompt at the start", () => {
      const options: PromptOptions = {
        ...baseOptions,
        basePrompt: "Custom instruction for classification.",
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt.startsWith("Custom instruction for classification.")).toBe(true);
    });

    it("trims whitespace from base prompt", () => {
      const options: PromptOptions = {
        ...baseOptions,
        basePrompt: "  Padded prompt  \n\n",
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt.startsWith("Padded prompt")).toBe(true);
    });
  });

  describe("response format", () => {
    it("includes response format section", () => {
      const prompt = buildPrompt(baseEmail, baseOptions);

      expect(prompt).toContain("## Response Format");
      expect(prompt).toContain("You MUST respond with valid JSON");
    });
  });

  describe("confidence options", () => {
    it("includes confidence instruction when requestConfidence is true", () => {
      const options: PromptOptions = {
        ...baseOptions,
        requestConfidence: true,
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).toContain("confidence");
      expect(prompt).toContain("0.0");
      expect(prompt).toContain("1.0");
      expect(prompt).toContain("REQUIRED");
    });

    it("includes reasoning instruction when requestReasoning is true", () => {
      const options: PromptOptions = {
        ...baseOptions,
        requestReasoning: true,
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).toContain("reasoning");
      expect(prompt).toContain("explain");
    });

    it("includes both when both options are true", () => {
      const options: PromptOptions = {
        ...baseOptions,
        requestConfidence: true,
        requestReasoning: true,
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).toContain("confidence");
      expect(prompt).toContain("reasoning");
    });

    it("excludes confidence/reasoning when options are false", () => {
      const options: PromptOptions = {
        ...baseOptions,
        requestConfidence: false,
        requestReasoning: false,
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).not.toContain("The `confidence` field is REQUIRED");
      expect(prompt).not.toContain("The `reasoning` field is REQUIRED");
    });
  });
});

describe("truncateToTokens", () => {
  it("returns text unchanged if under limit", () => {
    const text = "Short text";
    const result = truncateToTokens(text, 1000);

    expect(result).toBe(text);
  });

  it("truncates long text", () => {
    const text = "a".repeat(5000);
    const result = truncateToTokens(text, 100);

    expect(result.length).toBeLessThan(text.length);
    expect(result).toContain("[Content truncated...]");
  });

  it("truncates at word boundary when possible", () => {
    const text = "word ".repeat(200);
    const result = truncateToTokens(text, 50);

    expect(result).toContain("[Content truncated...]");
    expect(result).not.toMatch(/word$/);
  });
});
