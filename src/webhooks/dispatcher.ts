import type { WebhookConfig, WebhookEvent } from "../config/schema.js";
import type { LlmAction } from "../llm/parser.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("webhooks");

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  account?: string;
  error?: string;
  message_id?: string;
  actions?: LlmAction[];
  llm_provider?: string;
  reason?: string;
}

const accountWebhooks = new Map<string, WebhookConfig[]>();
const globalWebhooks: WebhookConfig[] = [];

export function registerWebhooks(
  accountName: string,
  webhooks: WebhookConfig[]
): void {
  accountWebhooks.set(accountName, webhooks);
  logger.debug("Registered webhooks for account", {
    account: accountName,
    count: webhooks.length,
  });
}

export function unregisterWebhooks(accountName: string): void {
  accountWebhooks.delete(accountName);
  logger.debug("Unregistered webhooks for account", { account: accountName });
}

export function registerGlobalWebhooks(webhooks: WebhookConfig[]): void {
  globalWebhooks.push(...webhooks);
  logger.debug("Registered global webhooks", { count: webhooks.length });
}

export async function dispatchEvent(
  event: WebhookEvent,
  accountName?: string,
  data?: Partial<Omit<WebhookPayload, "event" | "timestamp" | "account">>
): Promise<void> {
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
  };

  if (accountName !== undefined) {
    payload.account = accountName;
  }

  if (data) {
    if (data.error !== undefined) payload.error = data.error;
    if (data.message_id !== undefined) payload.message_id = data.message_id;
    if (data.actions !== undefined) payload.actions = data.actions;
    if (data.llm_provider !== undefined) payload.llm_provider = data.llm_provider;
    if (data.reason !== undefined) payload.reason = data.reason;
  }

  const webhooksToNotify: WebhookConfig[] = [];

  if (event === "startup" || event === "shutdown") {
    for (const [, webhooks] of accountWebhooks) {
      for (const webhook of webhooks) {
        if (webhook.events.includes(event)) {
          webhooksToNotify.push(webhook);
        }
      }
    }
    for (const webhook of globalWebhooks) {
      if (webhook.events.includes(event)) {
        webhooksToNotify.push(webhook);
      }
    }
  } else if (accountName) {
    const webhooks = accountWebhooks.get(accountName) ?? [];
    for (const webhook of webhooks) {
      if (webhook.events.includes(event)) {
        webhooksToNotify.push(webhook);
      }
    }
  }

  await Promise.allSettled(
    webhooksToNotify.map((webhook) => sendWebhook(webhook, payload))
  );
}

async function sendWebhook(
  webhook: WebhookConfig,
  payload: WebhookPayload
): Promise<void> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...webhook.headers,
    };

    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.warn("Webhook request failed", {
        url: webhook.url,
        status: response.status,
        event: payload.event,
      });
    } else {
      logger.debug("Webhook delivered", {
        url: webhook.url,
        event: payload.event,
      });
    }
  } catch (error) {
    logger.error("Webhook delivery error", {
      url: webhook.url,
      event: payload.event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function dispatchStartup(): Promise<void> {
  await dispatchEvent("startup");
}

export async function dispatchShutdown(reason?: string): Promise<void> {
  if (reason !== undefined) {
    await dispatchEvent("shutdown", undefined, { reason });
  } else {
    await dispatchEvent("shutdown");
  }
}

export async function dispatchError(
  accountName: string,
  error: string,
  messageId?: string
): Promise<void> {
  if (messageId !== undefined) {
    await dispatchEvent("error", accountName, {
      error,
      message_id: messageId,
    });
  } else {
    await dispatchEvent("error", accountName, { error });
  }
}

export async function dispatchActionTaken(
  accountName: string,
  messageId: string,
  actions: LlmAction[],
  llmProvider: string
): Promise<void> {
  await dispatchEvent("action_taken", accountName, {
    message_id: messageId,
    actions,
    llm_provider: llmProvider,
  });
}

export async function dispatchConnectionLost(accountName: string): Promise<void> {
  await dispatchEvent("connection_lost", accountName);
}

export async function dispatchConnectionRestored(
  accountName: string
): Promise<void> {
  await dispatchEvent("connection_restored", accountName);
}
