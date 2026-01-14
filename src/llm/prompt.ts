import { RESPONSE_SCHEMA } from "./parser.js";

export interface EmailContext {
  from: string;
  subject: string;
  date: string;
  body: string;
  attachmentNames?: string[];
  threadContext?: string;
}

export interface PromptOptions {
  basePrompt: string;
  folderMode: "predefined" | "auto_create";
  allowedFolders?: string[];
  existingFolders?: string[];
}

export function buildPrompt(
  email: EmailContext,
  options: PromptOptions
): string {
  const parts: string[] = [];

  parts.push(options.basePrompt.trim());

  parts.push("\n\n---\n");

  if (options.folderMode === "predefined" && options.allowedFolders?.length) {
    parts.push("\n## Allowed Folders\n");
    parts.push(
      "You may ONLY move emails to these folders:\n" +
        options.allowedFolders.map((f) => `- ${f}`).join("\n")
    );
  }

  if (options.folderMode === "auto_create" && options.existingFolders?.length) {
    parts.push("\n## Existing Folders\n");
    parts.push(
      "These folders already exist. Prefer using existing folders over creating new ones:\n" +
        options.existingFolders.map((f) => `- ${f}`).join("\n")
    );
  }

  parts.push("\n\n## Response Format\n");
  parts.push(
    "You MUST respond with valid JSON in this exact format:\n```json\n" +
      RESPONSE_SCHEMA +
      "\n```"
  );

  parts.push("\n\n---\n\n## Email to Classify\n");

  parts.push(`**From:** ${email.from}`);
  parts.push(`**Subject:** ${email.subject}`);
  parts.push(`**Date:** ${email.date}`);

  if (email.attachmentNames?.length) {
    parts.push(`**Attachments:** ${email.attachmentNames.join(", ")}`);
  }

  parts.push("\n**Body:**\n");
  parts.push(email.body);

  if (email.threadContext) {
    parts.push("\n\n## Thread Context (Previous Messages)\n");
    parts.push(email.threadContext);
  }

  return parts.join("\n");
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const approxCharsPerToken = 4;
  const maxChars = maxTokens * approxCharsPerToken;

  if (text.length <= maxChars) {
    return text;
  }

  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxChars * 0.8) {
    return truncated.slice(0, lastSpace) + "\n\n[Content truncated...]";
  }

  return truncated + "\n\n[Content truncated...]";
}
