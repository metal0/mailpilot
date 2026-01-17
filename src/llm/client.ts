import type { LlmProviderConfig } from "../config/schema.js";
import { createLogger } from "../utils/logger.js";
import { retry } from "../utils/retry.js";
import {
  acquireRateLimit,
  handleRateLimitResponse,
} from "./rate-limiter.js";
import { parseLlmResponse, type ParsedLlmResult } from "./parser.js";
import { recordProviderRequest, recordProviderFailure } from "./providers.js";
import type { MultimodalContent } from "../attachments/index.js";

const logger = createLogger("llm-client");

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | MultimodalContent[];
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LlmRequestOptions {
  provider: LlmProviderConfig;
  model: string;
  prompt: string;
  multimodalContent?: MultimodalContent[];
  temperature?: number;
}

export async function classifyEmail(
  options: LlmRequestOptions
): Promise<ParsedLlmResult> {
  const { provider, model, prompt, multimodalContent, temperature = 0.3 } = options;

  await acquireRateLimit(provider.api_url, provider.rate_limit_rpm);

  // Use multimodal content if provided and provider supports vision
  const messageContent = multimodalContent && provider.supports_vision
    ? multimodalContent
    : prompt;

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: messageContent,
    },
  ];

  const requestBody = {
    model,
    messages,
    temperature,
    response_format: { type: "json_object" },
  };

  const isMultimodal = Array.isArray(messageContent);
  logger.debug("Sending request to LLM", {
    provider: provider.name,
    model,
    promptLength: prompt.length,
    isMultimodal,
    imageCount: isMultimodal ? messageContent.filter(c => c.type === "image_url").length : 0,
  });

  let response: ChatCompletionResponse;
  try {
    response = await retry(
      async () => {
        const res = await fetch(provider.api_url, {
          method: "POST",
          headers: buildHeaders(provider),
          body: JSON.stringify(requestBody),
        });

        if (res.status === 429) {
          const retryAfter = res.headers.get("retry-after");
          handleRateLimitResponse(
            provider.api_url,
            retryAfter ? parseInt(retryAfter, 10) : undefined
          );
          throw new Error("Rate limited");
        }

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`LLM API error: ${res.status} - ${errorText}`);
        }

        return res.json() as Promise<ChatCompletionResponse>;
      },
      {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        retryIf: (error) => {
          if (error instanceof Error) {
            return (
              error.message.includes("Rate limited") ||
              error.message.includes("429") ||
              error.message.includes("500") ||
              error.message.includes("502") ||
              error.message.includes("503")
            );
          }
          return false;
        },
      }
    );
  } catch (error) {
    // Record failure after all retries exhausted
    recordProviderFailure(provider.name);
    throw error;
  }

  // Record successful request
  recordProviderRequest(provider.name);

  const content = response.choices[0]?.message.content;
  if (!content) {
    logger.error("Empty response from LLM");
    return { actions: [{ type: "noop", reason: "Empty LLM response" }] };
  }

  logger.debug("Received response from LLM", {
    provider: provider.name,
    responseLength: content.length,
    usage: response.usage,
  });

  const result = parseLlmResponse(content);

  // Add usage info if provided by the LLM
  if (response.usage) {
    result.usage = {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    };
  }

  return result;
}

function buildHeaders(provider: LlmProviderConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (provider.api_key) {
    if (provider.api_url.includes("anthropic.com")) {
      headers["x-api-key"] = provider.api_key;
      headers["anthropic-version"] = "2023-06-01";
    } else if (provider.api_url.includes("openai.azure.com")) {
      headers["api-key"] = provider.api_key;
    } else {
      headers["Authorization"] = `Bearer ${provider.api_key}`;
    }
  }

  return headers;
}

export async function testConnection(
  provider: LlmProviderConfig,
  model: string
): Promise<boolean> {
  try {
    const result = await classifyEmail({
      provider,
      model,
      prompt: 'Test connection. Respond with: {"actions": [{"type": "noop"}]}',
    });

    return result.actions.length > 0;
  } catch (error) {
    logger.error("LLM connection test failed", {
      provider: provider.name,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
