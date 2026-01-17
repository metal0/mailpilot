import { z } from "zod";
import { createLogger } from "../utils/logger.js";
import { type ActionType, ALL_ACTION_TYPES, DEFAULT_ALLOWED_ACTIONS } from "../config/schema.js";

const logger = createLogger("llm-parser");

const actionTypeSchema = z.enum([
  "move",
  "spam",
  "flag",
  "read",
  "delete",
  "noop",
]);

// Re-export for convenience
export { ALL_ACTION_TYPES, DEFAULT_ALLOWED_ACTIONS };
export type { ActionType };

const llmActionSchema = z.object({
  type: actionTypeSchema,
  folder: z.string().optional(),
  flags: z.array(z.string()).optional(),
  reason: z.string().optional(),
});

const llmResponseSchema = z.object({
  actions: z.array(llmActionSchema),
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional(),
});

export type LlmAction = z.infer<typeof llmActionSchema>;
export type LlmResponse = z.infer<typeof llmResponseSchema>;

export interface ParsedLlmResult {
  actions: LlmAction[];
  confidence?: number;
  reasoning?: string;
}

export function parseLlmResponse(content: string): ParsedLlmResult {
  let cleaned = content.trim();

  const jsonMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(cleaned);
  if (jsonMatch?.[1]) {
    cleaned = jsonMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    logger.warn("Failed to parse LLM response as JSON, attempting recovery", {
      contentLength: content.length,
    });

    const objectMatch = /\{[\s\S]*\}/.exec(cleaned);
    if (objectMatch) {
      try {
        parsed = JSON.parse(objectMatch[0]);
      } catch {
        logger.error("Failed to recover JSON from LLM response");
        return { actions: [{ type: "noop", reason: "Failed to parse LLM response" }] };
      }
    } else {
      return { actions: [{ type: "noop", reason: "No JSON found in LLM response" }] };
    }
  }

  const result = llmResponseSchema.safeParse(parsed);
  if (result.success) {
    return {
      actions: validateActions(result.data.actions),
      confidence: result.data.confidence,
      reasoning: result.data.reasoning,
    };
  }

  // Try to extract confidence/reasoning even if actions parsing fails partially
  let confidence: number | undefined;
  let reasoning: string | undefined;

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.confidence === "number" && obj.confidence >= 0 && obj.confidence <= 1) {
      confidence = obj.confidence;
    }
    if (typeof obj.reasoning === "string") {
      reasoning = obj.reasoning;
    }
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "actions" in parsed &&
    Array.isArray((parsed as { actions: unknown }).actions)
  ) {
    const actions = (parsed as { actions: unknown[] }).actions;
    const validActions: LlmAction[] = [];

    for (const action of actions) {
      const actionResult = llmActionSchema.safeParse(action);
      if (actionResult.success) {
        validActions.push(actionResult.data);
      } else {
        logger.debug("Skipping invalid action in response", {
          action,
          errors: actionResult.error.issues,
        });
      }
    }

    if (validActions.length > 0) {
      return {
        actions: validateActions(validActions),
        confidence,
        reasoning,
      };
    }
  }

  logger.warn("No valid actions found in LLM response", {
    parseErrors: result.error.issues,
  });
  return { actions: [{ type: "noop", reason: "No valid actions in LLM response" }] };
}

function validateActions(actions: LlmAction[]): LlmAction[] {
  const validated: LlmAction[] = [];

  for (const action of actions) {
    if (action.type === "move" && !action.folder) {
      logger.warn("Move action missing folder, converting to noop");
      validated.push({ type: "noop", reason: "Move action missing folder" });
      continue;
    }

    if (action.type === "flag" && (!action.flags || action.flags.length === 0)) {
      logger.warn("Flag action missing flags, converting to noop");
      validated.push({ type: "noop", reason: "Flag action missing flags" });
      continue;
    }

    validated.push(action);
  }

  if (validated.length === 0) {
    return [{ type: "noop", reason: "No actions after validation" }];
  }

  return validated;
}

export const RESPONSE_SCHEMA = `{
  "actions": [
    {
      "type": "move" | "spam" | "flag" | "read" | "delete" | "noop",
      "folder": "string (required for move action)",
      "flags": ["string array (required for flag action, e.g., 'Flagged', 'Seen')"],
      "reason": "string (optional, for audit log)"
    }
  ]
}`;

/**
 * Generate a response schema with only the allowed action types
 */
export function generateResponseSchema(allowedActions: ActionType[]): string {
  const typeStr = allowedActions.map((a) => `"${a}"`).join(" | ");
  return `{
  "actions": [
    {
      "type": ${typeStr},
      "folder": "string (required for move action)",
      "flags": ["string array (required for flag action, e.g., 'Flagged', 'Seen')"],
      "reason": "string (optional, for audit log)"
    }
  ]
}`;
}

/**
 * Generate a response schema with optional confidence and reasoning fields
 */
export function generateResponseSchemaWithConfidence(
  allowedActions: ActionType[],
  includeConfidence?: boolean,
  includeReasoning?: boolean
): string {
  const typeStr = allowedActions.map((a) => `"${a}"`).join(" | ");
  const extraFields: string[] = [];

  if (includeConfidence) {
    extraFields.push(`  "confidence": 0.0-1.0 (REQUIRED, your certainty level)`);
  }
  if (includeReasoning) {
    extraFields.push(`  "reasoning": "string (REQUIRED, brief explanation of your classification)"`);
  }

  const extraFieldsStr = extraFields.length > 0 ? ",\n" + extraFields.join(",\n") : "";

  return `{
  "actions": [
    {
      "type": ${typeStr},
      "folder": "string (required for move action)",
      "flags": ["string array (required for flag action, e.g., 'Flagged', 'Seen')"],
      "reason": "string (optional, for audit log)"
    }
  ]${extraFieldsStr}
}`;
}

/**
 * Filter out actions that are not in the allowed list.
 * Disallowed actions are converted to noop with a reason.
 */
export function filterDisallowedActions(
  actions: LlmAction[],
  allowedActions: ActionType[]
): LlmAction[] {
  const allowedSet = new Set(allowedActions);
  const filtered: LlmAction[] = [];

  for (const action of actions) {
    if (allowedSet.has(action.type)) {
      filtered.push(action);
    } else {
      logger.warn("Blocked disallowed action", {
        type: action.type,
        allowedActions,
      });
      filtered.push({
        type: "noop",
        reason: `Action '${action.type}' is not allowed for this account`,
      });
    }
  }

  // Ensure we always have at least one action
  if (filtered.length === 0) {
    return [{ type: "noop", reason: "No allowed actions" }];
  }

  return filtered;
}
