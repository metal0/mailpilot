import type { LlmProviderConfig, ActionType, FolderMode } from "../config/schema.js";
import { DEFAULT_ALLOWED_ACTIONS } from "../config/schema.js";
import { classifyEmail } from "./client.js";
import { buildPrompt, truncateToTokens, type EmailContext, type PromptOptions } from "./prompt.js";
import { filterDisallowedActions, type LlmAction } from "./parser.js";
import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("test-classification");

export interface TestClassificationRequest {
  prompt: string;
  email: {
    from: string;
    subject: string;
    body: string;
    attachments?: string[] | undefined;
  };
  folderMode: FolderMode;
  allowedFolders?: string[] | undefined;
  existingFolders?: string[] | undefined;
  allowedActions?: ActionType[] | undefined;
  provider: LlmProviderConfig;
  model?: string | undefined;
}

export interface TestClassificationResponse {
  success: boolean;
  classification?: {
    actions: LlmAction[];
    rawResponse: string;
  };
  error?: string;
  promptUsed: string;
  latencyMs: number;
}

export interface RawTestClassificationRequest {
  prompt: string;
  rawEmail: string;
  folderMode: FolderMode;
  allowedFolders?: string[] | undefined;
  existingFolders?: string[] | undefined;
  allowedActions?: ActionType[] | undefined;
  provider: LlmProviderConfig;
  model?: string | undefined;
}

export interface ParsedEmailInfo {
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  attachments: { filename: string; contentType: string; size: number }[];
}

export interface RawTestClassificationResponse extends TestClassificationResponse {
  parsed?: ParsedEmailInfo;
}

export interface ValidatePromptRequest {
  prompt: string;
  allowedActions?: ActionType[] | undefined;
}

export interface ValidationError {
  line?: number;
  message: string;
}

export interface ValidationWarning {
  line?: number;
  message: string;
}

export interface ValidatePromptResponse {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: {
    charCount: number;
    wordCount: number;
    estimatedTokens: number;
  };
}

function formatAddress(address: AddressObject | AddressObject[] | undefined): string {
  if (!address) return "";
  const addrObj = Array.isArray(address) ? address[0] : address;
  if (!addrObj) return "";
  const firstValue = addrObj.value[0];
  if (!firstValue) return "";
  return firstValue.name ? `${firstValue.name} <${firstValue.address}>` : firstValue.address || "";
}

export async function parseRawEmail(rawEmail: string): Promise<ParsedEmailInfo> {
  const parsed: ParsedMail = await simpleParser(rawEmail);

  const htmlText = parsed.html ? parsed.html.replace(/<[^>]*>/g, " ").trim() : "";
  return {
    from: formatAddress(parsed.from),
    to: formatAddress(parsed.to),
    subject: parsed.subject || "(no subject)",
    date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
    body: parsed.text || htmlText,
    attachments: parsed.attachments.map((a) => ({
      filename: a.filename || "unnamed",
      contentType: a.contentType || "application/octet-stream",
      size: a.size || 0,
    })),
  };
}

export async function testClassification(
  request: TestClassificationRequest
): Promise<TestClassificationResponse> {
  const startTime = Date.now();

  const emailContext: EmailContext = {
    from: request.email.from,
    subject: request.email.subject,
    date: new Date().toISOString(),
    body: truncateToTokens(request.email.body, request.provider.max_body_tokens || 4000),
    ...(request.email.attachments && { attachmentNames: request.email.attachments }),
  };

  const allowedActions = request.allowedActions ?? [...DEFAULT_ALLOWED_ACTIONS];

  const promptOptions: PromptOptions = {
    basePrompt: request.prompt,
    folderMode: request.folderMode,
    allowedActions,
    ...(request.folderMode === "predefined" && request.allowedFolders && { allowedFolders: request.allowedFolders }),
    ...(request.folderMode === "auto_create" && request.existingFolders && { existingFolders: request.existingFolders }),
  };

  const fullPrompt = buildPrompt(emailContext, promptOptions);

  try {
    const model = request.model || request.provider.default_model;

    logger.debug("Running test classification", {
      provider: request.provider.name,
      model,
      promptLength: fullPrompt.length,
    });

    const actions = await classifyEmail({
      provider: request.provider,
      model,
      prompt: fullPrompt,
    });

    const filteredActions = filterDisallowedActions(actions, allowedActions);

    return {
      success: true,
      classification: {
        actions: filteredActions,
        rawResponse: JSON.stringify({ actions: filteredActions }, null, 2),
      },
      promptUsed: fullPrompt,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    logger.error("Test classification failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      promptUsed: fullPrompt,
      latencyMs: Date.now() - startTime,
    };
  }
}

export async function testClassificationRaw(
  request: RawTestClassificationRequest
): Promise<RawTestClassificationResponse> {
  const startTime = Date.now();

  let parsed: ParsedEmailInfo;
  try {
    parsed = await parseRawEmail(request.rawEmail);
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse email: ${error instanceof Error ? error.message : String(error)}`,
      promptUsed: "",
      latencyMs: Date.now() - startTime,
    };
  }

  const attachmentNames = parsed.attachments.map((a) => a.filename);
  const emailContext: EmailContext = {
    from: parsed.from,
    subject: parsed.subject,
    date: parsed.date,
    body: truncateToTokens(parsed.body, request.provider.max_body_tokens || 4000),
    ...(attachmentNames.length > 0 && { attachmentNames }),
  };

  const allowedActions = request.allowedActions ?? [...DEFAULT_ALLOWED_ACTIONS];

  const promptOptions: PromptOptions = {
    basePrompt: request.prompt,
    folderMode: request.folderMode,
    allowedActions,
    ...(request.folderMode === "predefined" && request.allowedFolders && { allowedFolders: request.allowedFolders }),
    ...(request.folderMode === "auto_create" && request.existingFolders && { existingFolders: request.existingFolders }),
  };

  const fullPrompt = buildPrompt(emailContext, promptOptions);

  try {
    const model = request.model || request.provider.default_model;

    logger.debug("Running test classification (raw email)", {
      provider: request.provider.name,
      model,
      promptLength: fullPrompt.length,
      parsedFrom: parsed.from,
      parsedSubject: parsed.subject,
    });

    const actions = await classifyEmail({
      provider: request.provider,
      model,
      prompt: fullPrompt,
    });

    const filteredActions = filterDisallowedActions(actions, allowedActions);

    return {
      success: true,
      classification: {
        actions: filteredActions,
        rawResponse: JSON.stringify({ actions: filteredActions }, null, 2),
      },
      parsed,
      promptUsed: fullPrompt,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    logger.error("Test classification (raw) failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      parsed,
      promptUsed: fullPrompt,
      latencyMs: Date.now() - startTime,
    };
  }
}

const PROMPT_CHAR_LIMIT = 4000;

export function validatePrompt(request: ValidatePromptRequest): ValidatePromptResponse {
  const { prompt, allowedActions } = request;
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const charCount = prompt.length;
  const wordCount = prompt.split(/\s+/).filter(Boolean).length;
  const estimatedTokens = Math.ceil(charCount / 4);

  if (!prompt.trim()) {
    errors.push({ message: "Prompt cannot be empty" });
  }

  if (charCount > PROMPT_CHAR_LIMIT) {
    warnings.push({
      message: `Prompt is ${charCount} characters, which exceeds ${PROMPT_CHAR_LIMIT}. It may be truncated when combined with email content.`,
    });
  }

  const mentionsJson = /json|JSON|respond.*format|format.*respond/i.test(prompt);
  if (!mentionsJson) {
    warnings.push({
      message: "Prompt doesn't mention JSON format. Note: JSON schema is auto-injected, but you may want to mention it for clarity.",
    });
  }

  if (allowedActions && allowedActions.length > 0) {
    const actionPattern = /\b(move|spam|flag|read|delete|noop)\b/gi;
    const mentionedActions = [...prompt.matchAll(actionPattern)]
      .map((m) => m[1])
      .filter((s): s is string => s !== undefined)
      .map((s) => s.toLowerCase());
    const allowedSet = new Set(allowedActions.map((a) => a.toLowerCase()));

    for (const mentioned of mentionedActions) {
      if (!allowedSet.has(mentioned) && mentioned !== "noop") {
        warnings.push({
          message: `Prompt mentions "${mentioned}" action which is not in the allowed actions list.`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      charCount,
      wordCount,
      estimatedTokens,
    },
  };
}
