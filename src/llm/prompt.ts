import { generateResponseSchemaWithConfidence, type ActionType, ALL_ACTION_TYPES } from "./parser.js";
import type { ExtractedAttachment } from "../attachments/index.js";
import { formatAttachmentsForPrompt } from "../attachments/index.js";

export interface EmailContext {
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  attachmentNames?: string[];
  extractedAttachments?: ExtractedAttachment[];
  threadContext?: string;
}

export interface PromptOptions {
  basePrompt: string;
  folderMode: "predefined" | "auto_create";
  allowedFolders?: string[];
  existingFolders?: string[];
  // Allowed action types for this account. If not specified, all actions are allowed.
  allowedActions?: ActionType[];
  // Request confidence score from LLM
  requestConfidence?: boolean;
  // Request reasoning from LLM
  requestReasoning?: boolean;
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

  // Add allowed actions restriction if specified
  const effectiveAllowedActions = options.allowedActions ?? [...ALL_ACTION_TYPES];
  const hasActionRestriction = options.allowedActions && options.allowedActions.length < ALL_ACTION_TYPES.length;

  if (hasActionRestriction) {
    parts.push("\n## Allowed Actions\n");
    parts.push(
      "You may ONLY use these action types:\n" +
        effectiveAllowedActions.map((a) => `- ${a}`).join("\n")
    );

    // Explicitly mention disallowed actions
    const disallowed = ALL_ACTION_TYPES.filter((a) => !effectiveAllowedActions.includes(a));
    if (disallowed.length > 0) {
      parts.push(`\nDO NOT use these action types: ${disallowed.join(", ")}`);
    }
  }

  // Use dynamic schema based on allowed actions and confidence settings
  const responseSchema = generateResponseSchemaWithConfidence(
    hasActionRestriction ? effectiveAllowedActions : [...ALL_ACTION_TYPES],
    options.requestConfidence,
    options.requestReasoning
  );

  parts.push("\n\n## Response Format\n");
  parts.push(
    "You MUST respond with valid JSON in this exact format:\n```json\n" +
      responseSchema +
      "\n```"
  );

  if (options.requestConfidence) {
    parts.push("\n**Important:** The `confidence` field is REQUIRED. Rate your certainty from 0.0 (completely uncertain) to 1.0 (completely certain).");
  }
  if (options.requestReasoning) {
    parts.push("\n**Important:** The `reasoning` field is REQUIRED. Briefly explain why you chose this classification.");
  }

  parts.push("\n\n---\n\n## Email to Classify\n");

  parts.push(`**From:** ${email.from}`);
  parts.push(`**To:** ${email.to}`);
  parts.push(`**Subject:** ${email.subject}`);
  parts.push(`**Date:** ${email.date}`);

  if (email.attachmentNames?.length) {
    parts.push(`**Attachments:** ${email.attachmentNames.join(", ")}`);
  }

  parts.push("\n**Body:**\n");
  parts.push(email.body);

  // Add extracted attachment content if available
  if (email.extractedAttachments?.length) {
    parts.push(formatAttachmentsForPrompt(email.extractedAttachments));
  }

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
