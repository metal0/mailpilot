import { Hono, type Context } from "hono";
import { ALL_ACTION_TYPES, DEFAULT_ALLOWED_ACTIONS, type DashboardConfig, type ApiKeyPermission, type Config } from "../config/schema.js";
import {
  getUserCount,
  createUser,
  verifyPassword,
  createSession,
  deleteSession,
} from "../storage/dashboard.js";
import {
  getEmailsWithActionsCount,
  getActionBreakdown,
  getActionCount,
  getAuditEntriesPaginated,
  exportAuditLog,
  type AuditFilters,
} from "../storage/audit.js";
import {
  createSessionMiddleware,
  getAuthContext,
  setSessionCookie,
  clearSessionCookie,
  checkRateLimit,
  recordFailedLogin,
  clearFailedLogins,
  requireAuthOrApiKey,
} from "./auth.js";
import { getAccountStatuses, getUptime, getVersion } from "./status.js";
import { broadcastStats } from "./websocket.js";
import { getDetailedProviderStats, getAllProviders, updateProviderHealth } from "../llm/providers.js";
import { testConnection as testLlmConnection } from "../llm/client.js";
import {
  testClassification,
  testClassificationRaw,
  validatePrompt,
  type TestClassificationRequest,
  type RawTestClassificationRequest,
  type ValidatePromptRequest,
} from "../llm/test-classification.js";
import { getLogsPaginated, type LogLevel, type LogsFilter, createLogger } from "../utils/logger.js";

const logger = createLogger("dashboard");
import {
  getQueueStatus,
  pauseAccount,
  resumeAccount,
  isAccountPaused,
  reconnectAccount,
  triggerProcessing,
  getPausedAccounts,
  getAccountClient,
  reloadConfig,
  getCurrentConfig,
} from "../accounts/manager.js";
import { readFileSync, writeFileSync } from "node:fs";
import { stringify as yamlStringify, parse as yamlParse } from "yaml";
import { fetchAndParseEmail } from "../processor/email.js";
import {
  getDeadLetterEntries,
  getDeadLetterCount,
  resolveDeadLetter,
  removeDeadLetter,
  skipDeadLetter,
} from "../storage/dead-letter.js";
import { createTikaClient } from "../attachments/tika.js";
import { createAntivirusScanner } from "../processor/antivirus.js";
import { ImapFlow } from "imapflow";
import * as tls from "node:tls";
import {
  probeImapPort,
  probeTlsCertificate,
  detectImapProvider,
  type CertificateInfo,
} from "../imap/probe.js";

// Helper to build and broadcast current stats to all WebSocket clients
function broadcastCurrentStats(): void {
  const currentConfig = getCurrentConfig();
  const pausedAccountsList = getPausedAccounts();
  const allAccounts = getAccountStatuses();

  broadcastStats({
    version: getVersion(),
    uptime: getUptime(),
    dryRun: currentConfig?.dry_run ?? false,
    totals: {
      emailsProcessed: getActionCount(),
      actionsTaken: getEmailsWithActionsCount(),
      errors: allAccounts.reduce((sum, a) => sum + a.errors, 0),
    },
    accounts: allAccounts.map((a) => ({
      ...a,
      paused: pausedAccountsList.includes(a.name),
    })),
    actionBreakdown: getActionBreakdown(),
    providerStats: getDetailedProviderStats(),
    queueStatus: getQueueStatus(),
    deadLetterCount: getDeadLetterCount(),
  });
}

// Sensitive field names that should be masked in YAML config
const SENSITIVE_FIELDS = [
  "password",
  "oauth_client_secret",
  "oauth_refresh_token",
  "api_key",
  "session_secret",
  "auth_token",
];

/**
 * Mask sensitive values in a parsed config object.
 * Creates a deep copy with sensitive fields masked.
 */
function maskSensitiveConfig(config: unknown): unknown {
  if (config === null || config === undefined) {
    return config;
  }

  if (Array.isArray(config)) {
    return config.map(item => maskSensitiveConfig(item));
  }

  if (typeof config === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (SENSITIVE_FIELDS.includes(key) && typeof value === "string") {
        // Don't mask env var references or already masked values
        if (value.includes("${") || value === "********") {
          result[key] = value;
        } else if (value.trim() !== "") {
          result[key] = "********";
        } else {
          result[key] = value;
        }
      } else {
        result[key] = maskSensitiveConfig(value);
      }
    }
    return result;
  }

  return config;
}

/**
 * Restore masked sensitive values from original config.
 * Traverses both objects in parallel and replaces "********" with original values.
 */
function restoreSensitiveConfig(
  maskedConfig: unknown,
  originalConfig: unknown
): unknown {
  if (maskedConfig === null || maskedConfig === undefined) {
    return maskedConfig;
  }

  if (Array.isArray(maskedConfig)) {
    if (!Array.isArray(originalConfig)) {
      return maskedConfig;
    }
    return maskedConfig.map((item, index) =>
      restoreSensitiveConfig(item, originalConfig[index])
    );
  }

  if (typeof maskedConfig === "object") {
    if (typeof originalConfig !== "object" || originalConfig === null) {
      return maskedConfig;
    }
    const result: Record<string, unknown> = {};
    const origObj = originalConfig as Record<string, unknown>;

    for (const [key, value] of Object.entries(maskedConfig)) {
      if (SENSITIVE_FIELDS.includes(key) && value === "********") {
        // Restore original value if it was masked
        const originalValue = origObj[key];
        if (typeof originalValue === "string" && originalValue !== "********") {
          result[key] = originalValue;
        } else {
          result[key] = value;
        }
      } else {
        result[key] = restoreSensitiveConfig(value, origObj[key]);
      }
    }
    return result;
  }

  return maskedConfig;
}

interface ImapPreset {
  name: string;
  host: string;
  ports: { port: number; tls: "tls" | "starttls" | "none" }[];
  oauthSupported: boolean;
}

const IMAP_PRESETS: ImapPreset[] = [
  { name: "Gmail", host: "imap.gmail.com", ports: [{ port: 993, tls: "tls" }], oauthSupported: true },
  { name: "Outlook / Microsoft 365", host: "outlook.office365.com", ports: [{ port: 993, tls: "tls" }], oauthSupported: true },
  { name: "Yahoo Mail", host: "imap.mail.yahoo.com", ports: [{ port: 993, tls: "tls" }], oauthSupported: true },
  { name: "iCloud Mail", host: "imap.mail.me.com", ports: [{ port: 993, tls: "tls" }], oauthSupported: false },
  { name: "Fastmail", host: "imap.fastmail.com", ports: [{ port: 993, tls: "tls" }], oauthSupported: false },
  { name: "Zoho Mail", host: "imap.zoho.com", ports: [{ port: 993, tls: "tls" }], oauthSupported: false },
  { name: "AOL Mail", host: "imap.aol.com", ports: [{ port: 993, tls: "tls" }], oauthSupported: false },
  { name: "ProtonMail Bridge", host: "127.0.0.1", ports: [{ port: 1143, tls: "starttls" }], oauthSupported: false },
];

interface LlmPreset {
  name: string;
  api_url: string;
  default_model: string;
  api_key_placeholder: string;
  supports_vision?: boolean;
}

const LLM_PRESETS: LlmPreset[] = [
  {
    name: "OpenAI",
    api_url: "https://api.openai.com/v1/chat/completions",
    default_model: "gpt-4o",
    api_key_placeholder: "sk-...",
    supports_vision: true,
  },
  {
    name: "Anthropic",
    api_url: "https://api.anthropic.com/v1/messages",
    default_model: "claude-sonnet-4-20250514",
    api_key_placeholder: "sk-ant-...",
    supports_vision: true,
  },
  {
    name: "Google Gemini",
    api_url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    default_model: "gemini-2.0-flash",
    api_key_placeholder: "AIza...",
    supports_vision: true,
  },
  {
    name: "Mistral AI",
    api_url: "https://api.mistral.ai/v1/chat/completions",
    default_model: "mistral-large-latest",
    api_key_placeholder: "...",
    supports_vision: true,
  },
  {
    name: "Groq",
    api_url: "https://api.groq.com/openai/v1/chat/completions",
    default_model: "llama-3.3-70b-versatile",
    api_key_placeholder: "gsk_...",
    supports_vision: true,
  },
  {
    name: "xAI (Grok)",
    api_url: "https://api.x.ai/v1/chat/completions",
    default_model: "grok-3",
    api_key_placeholder: "xai-...",
    supports_vision: true,
  },
  {
    name: "OpenRouter",
    api_url: "https://openrouter.ai/api/v1/chat/completions",
    default_model: "anthropic/claude-sonnet-4",
    api_key_placeholder: "sk-or-...",
    supports_vision: true,
  },
  {
    name: "Together AI",
    api_url: "https://api.together.xyz/v1/chat/completions",
    default_model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    api_key_placeholder: "...",
    supports_vision: true,
  },
  {
    name: "DeepSeek",
    api_url: "https://api.deepseek.com/chat/completions",
    default_model: "deepseek-chat",
    api_key_placeholder: "sk-...",
    supports_vision: false,
  },
  {
    name: "Ollama (Local)",
    api_url: "http://localhost:11434/v1/chat/completions",
    default_model: "llama3.2",
    api_key_placeholder: "ollama",
    supports_vision: true,
  },
];

/**
 * SSRF protection: Block requests to private/local addresses.
 * This prevents the webhook test endpoint from being abused to probe internal networks.
 */
function isPrivateOrLocalUrl(url: string): boolean {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  // Block localhost variants
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") {
    return true;
  }

  // Block cloud metadata endpoints (AWS, GCP, Azure)
  if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
    return true;
  }

  // Block private IP ranges (RFC 1918)
  const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipMatch) {
    const octets = ipMatch.slice(1).map(Number);
    const a = octets[0];
    const b = octets[1];
    if (a === 10) return true;  // 10.0.0.0/8
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
    if (a === 192 && b === 168) return true;  // 192.168.0.0/16
    if (a === 0) return true;  // 0.0.0.0/8
  }

  // Block link-local addresses
  if (hostname.startsWith("169.254.")) return true;

  // Block IPv6 private/local ranges
  if (hostname.startsWith("fe80:") || hostname.startsWith("[fe80:")) return true;  // Link-local
  if (hostname.startsWith("fc") || hostname.startsWith("[fc")) return true;  // Unique local
  if (hostname.startsWith("fd") || hostname.startsWith("[fd")) return true;  // Unique local

  return false;
}

export interface DashboardRouterOptions {
  dashboardConfig: DashboardConfig;
  dryRun: boolean;
  configPath?: string;
}

export function createDashboardRouter(options: DashboardRouterOptions): Hono {
  const router = new Hono();
  const { dashboardConfig: config, dryRun, configPath } = options;
  const sessionTtl = config.session_ttl;

  router.use("*", createSessionMiddleware(sessionTtl));

  // Create auth bypass middleware for dry run mode
  const requireAuthOrApiKeyWithDryRun = (permission?: ApiKeyPermission) => {
    if (dryRun) {
      // In dry run mode, skip all authentication
      return async (_c: Context, next: () => Promise<void>) => {
        await next();
      };
    }
    return requireAuthOrApiKey(permission);
  };

  // Auth status endpoint - used by SPA to check authentication state
  router.get("/api/auth", (c) => {
    // In dry run mode, always return authenticated
    if (dryRun) {
      return c.json({
        authenticated: true,
        needsSetup: false,
        dryRun: true,
        user: { username: "dev" },
      });
    }

    const auth = getAuthContext(c);
    const needsSetup = getUserCount() === 0;

    if (needsSetup) {
      return c.json({ authenticated: false, needsSetup: true, dryRun: false });
    }

    if (!auth) {
      return c.json({ authenticated: false, needsSetup: false, dryRun: false });
    }

    return c.json({
      authenticated: true,
      needsSetup: false,
      dryRun: false,
      user: { username: auth.user.username },
    });
  });

  // Setup endpoint - create first admin account
  router.post("/api/setup", async (c) => {
    if (getUserCount() > 0) {
      return c.json({ error: "Setup already completed" }, 403);
    }

    const body = await c.req.json<{ username: string; password: string; confirm: string }>();
    const { username, password, confirm } = body;

    if (!username || username.length < 3) {
      return c.json({ error: "Username must be at least 3 characters" }, 400);
    }

    if (!password || password.length < 8) {
      return c.json({ error: "Password must be at least 8 characters" }, 400);
    }

    if (password !== confirm) {
      return c.json({ error: "Passwords do not match" }, 400);
    }

    const user = await createUser(username, password);
    const session = createSession(user.id, sessionTtl);
    setSessionCookie(c, session.id);

    return c.json({ success: true, user: { username: user.username } });
  });

  // Login endpoint
  router.post("/api/login", async (c) => {
    if (getUserCount() === 0) {
      return c.json({ error: "Setup required", needsSetup: true }, 400);
    }

    // Rate limiting
    const rateLimit = checkRateLimit(c);
    if (!rateLimit.allowed) {
      const minutes = Math.ceil((rateLimit.retryAfter ?? 900) / 60);
      return c.json({
        error: `Too many login attempts. Try again in ${minutes} minutes.`,
        retryAfter: rateLimit.retryAfter,
      }, 429);
    }

    const body = await c.req.json<{ username: string; password: string }>();
    const { username, password } = body;

    if (!username || !password) {
      return c.json({ error: "Username and password required" }, 400);
    }

    const user = await verifyPassword(username, password);
    if (!user) {
      recordFailedLogin(c);
      return c.json({ error: "Invalid username or password" }, 401);
    }

    clearFailedLogins(c);
    const session = createSession(user.id, sessionTtl);
    setSessionCookie(c, session.id);

    return c.json({ success: true, user: { username: user.username } });
  });

  // Logout endpoint
  router.post("/api/logout", (c) => {
    const auth = getAuthContext(c);
    if (auth) {
      deleteSession(auth.sessionId);
    }
    clearSessionCookie(c);
    return c.json({ success: true });
  });

  // Stats endpoint
  router.get("/api/stats", requireAuthOrApiKeyWithDryRun("read:stats"), (c) => {
    const accounts = getAccountStatuses();
    const pausedAccountsList = getPausedAccounts();
    const currentConfig = getCurrentConfig();

    return c.json({
      version: getVersion(),
      uptime: getUptime(),
      dryRun: currentConfig?.dry_run ?? dryRun,
      confidenceEnabled: currentConfig?.confidence?.enabled ?? false,
      totals: {
        emailsProcessed: getActionCount(),
        actionsTaken: getEmailsWithActionsCount(),
        errors: accounts.reduce((sum, a) => sum + a.errors, 0),
      },
      accounts: accounts.map((a) => ({
        ...a,
        paused: pausedAccountsList.includes(a.name),
      })),
      actionBreakdown: getActionBreakdown(),
      providerStats: getDetailedProviderStats(),
      queueStatus: getQueueStatus(),
      deadLetterCount: getDeadLetterCount(),
    });
  });

  router.get("/api/activity", requireAuthOrApiKeyWithDryRun("read:activity"), (c) => {
    const page = parseInt(c.req.query("page") ?? "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") ?? "20", 10);

    const filters: AuditFilters = {};
    const accountName = c.req.query("accountName");
    const actionType = c.req.query("actionType");
    const actionTypes = c.req.query("actionTypes");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const search = c.req.query("search");

    if (accountName) filters.accountName = accountName;
    if (actionTypes) {
      filters.actionTypes = actionTypes.split(",").map((t) => t.trim()).filter(Boolean);
    } else if (actionType) {
      filters.actionType = actionType;
    }
    if (startDate) filters.startDate = parseInt(startDate, 10);
    if (endDate) filters.endDate = parseInt(endDate, 10);
    if (search) filters.search = search;

    return c.json(getAuditEntriesPaginated(page, pageSize, filters));
  });

  router.get("/api/logs", requireAuthOrApiKeyWithDryRun("read:logs"), (c) => {
    const page = parseInt(c.req.query("page") ?? "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") ?? "50", 10);
    const levelFilter = c.req.query("level") as LogLevel | undefined;
    const accountName = c.req.query("accountName");

    const filter: LogsFilter = {};
    if (levelFilter) filter.level = levelFilter;
    if (accountName) filter.accountName = accountName;

    const result = getLogsPaginated(page, pageSize, filter);
    return c.json(result);
  });

  router.get("/api/export", requireAuthOrApiKeyWithDryRun("read:export"), (c) => {
    const format = c.req.query("format") ?? "json";
    const filters: AuditFilters = {};

    const accountName = c.req.query("accountName");
    const actionType = c.req.query("actionType");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const search = c.req.query("search");

    if (accountName) filters.accountName = accountName;
    if (actionType) filters.actionType = actionType;
    if (startDate) filters.startDate = parseInt(startDate, 10);
    if (endDate) filters.endDate = parseInt(endDate, 10);
    if (search) filters.search = search;

    const entries = exportAuditLog(filters);

    if (format === "csv") {
      const header = "ID,Message ID,Account,Actions,Provider,Model,Subject,Created At\n";
      const rows = entries.map((e) =>
        [
          e.id,
          `"${e.messageId}"`,
          `"${e.accountName}"`,
          `"${e.actions.map((a) => a.type).join(", ")}"`,
          `"${e.llmProvider ?? ""}"`,
          `"${e.llmModel ?? ""}"`,
          `"${(e.subject ?? "").replace(/"/g, '""')}"`,
          new Date(e.createdAt).toISOString(),
        ].join(",")
      );
      const csv = header + rows.join("\n");

      c.header("Content-Type", "text/csv");
      c.header("Content-Disposition", "attachment; filename=audit-log.csv");
      return c.body(csv);
    }

    return c.json(entries);
  });

  // Account management actions
  router.post("/api/accounts/:name/pause", requireAuthOrApiKeyWithDryRun("write:accounts"), (c) => {
    const name = c.req.param("name");
    const success = pauseAccount(name);

    if (success) {
      broadcastCurrentStats();
    }

    return c.json({ success, paused: success ? true : isAccountPaused(name) });
  });

  router.post("/api/accounts/:name/resume", requireAuthOrApiKeyWithDryRun("write:accounts"), (c) => {
    const name = c.req.param("name");
    const success = resumeAccount(name);

    if (success) {
      broadcastCurrentStats();
    }

    return c.json({ success, paused: success ? false : isAccountPaused(name) });
  });

  router.post("/api/accounts/:name/reconnect", requireAuthOrApiKeyWithDryRun("write:accounts"), async (c) => {
    const name = c.req.param("name");
    const success = await reconnectAccount(name);

    return c.json({ success });
  });

  router.post("/api/accounts/:name/process", requireAuthOrApiKeyWithDryRun("write:accounts"), async (c) => {
    const name = c.req.param("name");
    const folder = c.req.query("folder") ?? "INBOX";
    const success = await triggerProcessing(name, folder);

    return c.json({ success });
  });

  // Config reload endpoint
  router.post("/api/reload-config", requireAuthOrApiKeyWithDryRun("write:accounts"), async (c) => {
    try {
      const result = await reloadConfig();
      return c.json(result);
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  // Get IMAP presets
  router.get("/api/imap-presets", requireAuthOrApiKeyWithDryRun("read:stats"), (c) => {
    return c.json({
      presets: IMAP_PRESETS.map(p => ({ name: p.name, host: p.host })),
    });
  });

  // Get LLM presets
  router.get("/api/llm-presets", requireAuthOrApiKeyWithDryRun("read:stats"), (c) => {
    return c.json({
      presets: LLM_PRESETS.map(p => ({
        name: p.name,
        api_url: p.api_url,
        default_model: p.default_model,
        api_key_placeholder: p.api_key_placeholder,
        supports_vision: p.supports_vision ?? false,
      })),
    });
  });

  // Get available action types
  router.get("/api/action-types", requireAuthOrApiKeyWithDryRun("read:stats"), (c) => {
    return c.json({
      actionTypes: ALL_ACTION_TYPES,
      defaultAllowed: DEFAULT_ALLOWED_ACTIONS,
    });
  });

  // Test LLM connection
  router.post("/api/test-llm", requireAuthOrApiKeyWithDryRun("write:accounts"), async (c) => {
    try {
      const body = await c.req.json<{
        api_url: string;
        api_key?: string;
        default_model: string;
        name?: string; // Optional: used to lookup existing API key if masked
      }>();

      const { api_url, default_model, name } = body;
      let { api_key } = body;

      // Debug logging
      logger.debug("[test-llm] Request body", { api_url, api_key: api_key ? api_key.substring(0, 4) + "..." : undefined, default_model, name });

      if (!api_url || !default_model) {
        return c.json({ success: false, error: "API URL and model are required" });
      }

      // If API key is masked and we have a provider name, look up the real key
      if (api_key === "********" && name) {
        const currentConfig = getCurrentConfig();
        const existingProvider = currentConfig?.llm_providers.find((p) => p.name === name);
        if (existingProvider?.api_key) {
          api_key = existingProvider.api_key;
        } else {
          return c.json({ success: false, error: "Cannot test: API key is masked and no existing provider found" });
        }
      }

      // Build a temporary provider config for testing
      const testProvider = {
        name: name ?? "_test_",
        api_url,
        api_key,
        default_model,
        max_body_tokens: 4000,
        max_thread_tokens: 2000,
        supports_vision: false,
        rate_limit_rpm: 60,
      };

      const result = await testLlmConnection(testProvider, default_model);

      return c.json({
        success: result.success,
        error: result.error,
        errorCode: result.errorCode,
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  // Test classification sandbox - structured email
  router.post("/api/test-classification", requireAuthOrApiKeyWithDryRun("write:accounts"), async (c) => {
    try {
      const body = await c.req.json<{
        prompt: string;
        email: {
          from: string;
          to: string;
          subject: string;
          body: string;
          attachments?: string[];
        };
        folderMode: "predefined" | "auto_create";
        allowedFolders?: string[];
        existingFolders?: string[];
        allowedActions?: string[];
        providerName: string;
        model?: string;
        requestConfidence?: boolean;
        requestReasoning?: boolean;
      }>();

      const { prompt, email, folderMode, allowedFolders, existingFolders, allowedActions, providerName, model, requestConfidence, requestReasoning } = body;

      if (!prompt || !prompt.trim()) {
        return c.json({ success: false, error: "Prompt is required" }, 400);
      }

      if (!email.from || !email.to || !email.subject || !email.body) {
        return c.json({ success: false, error: "Email from, to, subject, and body are required" }, 400);
      }

      if (!providerName) {
        return c.json({ success: false, error: "Provider name is required" }, 400);
      }

      const provider = getAllProviders().find((p) => p.name === providerName);
      if (!provider) {
        return c.json({ success: false, error: `Provider "${providerName}" not found` }, 404);
      }

      const request: TestClassificationRequest = {
        prompt,
        email,
        folderMode,
        provider,
        ...(allowedFolders && { allowedFolders }),
        ...(existingFolders && { existingFolders }),
        ...(allowedActions && { allowedActions: allowedActions as TestClassificationRequest["allowedActions"] }),
        ...(model && { model }),
        ...(requestConfidence !== undefined && { requestConfidence }),
        ...(requestReasoning !== undefined && { requestReasoning }),
      };

      const result = await testClassification(request);
      return c.json(result);
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        promptUsed: "",
        latencyMs: 0,
      }, 500);
    }
  });

  // Test classification sandbox - raw RFC822 email
  router.post("/api/test-classification/raw", requireAuthOrApiKeyWithDryRun("write:accounts"), async (c) => {
    try {
      const body = await c.req.json<{
        prompt: string;
        rawEmail: string;
        folderMode: "predefined" | "auto_create";
        allowedFolders?: string[];
        existingFolders?: string[];
        allowedActions?: string[];
        providerName: string;
        model?: string;
        requestConfidence?: boolean;
        requestReasoning?: boolean;
      }>();

      const { prompt, rawEmail, folderMode, allowedFolders, existingFolders, allowedActions, providerName, model, requestConfidence, requestReasoning } = body;

      if (!prompt || !prompt.trim()) {
        return c.json({ success: false, error: "Prompt is required" }, 400);
      }

      if (!rawEmail || !rawEmail.trim()) {
        return c.json({ success: false, error: "Raw email content is required" }, 400);
      }

      if (!providerName) {
        return c.json({ success: false, error: "Provider name is required" }, 400);
      }

      const provider = getAllProviders().find((p) => p.name === providerName);
      if (!provider) {
        return c.json({ success: false, error: `Provider "${providerName}" not found` }, 404);
      }

      const request: RawTestClassificationRequest = {
        prompt,
        rawEmail,
        folderMode,
        provider,
        ...(allowedFolders && { allowedFolders }),
        ...(existingFolders && { existingFolders }),
        ...(allowedActions && { allowedActions: allowedActions as RawTestClassificationRequest["allowedActions"] }),
        ...(model && { model }),
        ...(requestConfidence !== undefined && { requestConfidence }),
        ...(requestReasoning !== undefined && { requestReasoning }),
      };

      const result = await testClassificationRaw(request);
      return c.json(result);
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        promptUsed: "",
        latencyMs: 0,
      }, 500);
    }
  });

  // Validate prompt
  router.post("/api/validate-prompt", requireAuthOrApiKeyWithDryRun("read:activity"), async (c) => {
    try {
      const body = await c.req.json<{
        prompt: string;
        allowedActions?: string[];
        folderMode?: string;
        folderCount?: number;
        requestConfidence?: boolean;
        requestReasoning?: boolean;
      }>();

      const request: ValidatePromptRequest = {
        prompt: body.prompt || "",
        ...(body.allowedActions && { allowedActions: body.allowedActions as ValidatePromptRequest["allowedActions"] }),
        ...(body.folderMode && { folderMode: body.folderMode as ValidatePromptRequest["folderMode"] }),
        ...(body.folderCount !== undefined && { folderCount: body.folderCount }),
        ...(body.requestConfidence !== undefined && { requestConfidence: body.requestConfidence }),
        ...(body.requestReasoning !== undefined && { requestReasoning: body.requestReasoning }),
      };

      const result = validatePrompt(request);
      return c.json(result);
    } catch (error) {
      return c.json({
        valid: false,
        errors: [{ message: error instanceof Error ? error.message : String(error) }],
        warnings: [],
        stats: { charCount: 0, wordCount: 0, estimatedTokens: 0 },
      }, 500);
    }
  });

  // Extract text from uploaded file using Tika (for sandbox testing)
  router.post("/api/extract-attachment", requireAuthOrApiKeyWithDryRun("write:accounts"), async (c) => {
    try {
      const currentConfig = getCurrentConfig();

      if (!currentConfig?.attachments?.enabled) {
        return c.json({
          success: false,
          error: "Attachment extraction is not enabled. Configure attachments.enabled in config.",
        }, 400);
      }

      const tikaClient = createTikaClient(currentConfig.attachments);
      const isHealthy = await tikaClient.isHealthy();

      if (!isHealthy) {
        return c.json({
          success: false,
          error: "Tika service is not available. Check if Tika is running.",
        }, 503);
      }

      const formData = await c.req.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof File)) {
        return c.json({
          success: false,
          error: "No file uploaded",
        }, 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await tikaClient.extractText(buffer, file.name);

      if (result.error) {
        return c.json({
          success: false,
          error: result.error,
        }, 500);
      }

      return c.json({
        success: true,
        filename: file.name,
        contentType: result.contentType,
        text: result.text,
        truncated: result.truncated,
        size: buffer.length,
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  // Test Webhook connectivity
  router.post("/api/test-webhook", requireAuthOrApiKeyWithDryRun("write:accounts"), async (c) => {
    try {
      const body = await c.req.json<{
        url: string;
        headers?: Record<string, string>;
      }>();

      const { url, headers } = body;

      if (!url) {
        return c.json({ success: false, error: "URL is required" });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return c.json({ success: false, error: "Invalid URL format" });
      }

      // SSRF protection: Block requests to private/local addresses
      if (isPrivateOrLocalUrl(url)) {
        return c.json({ success: false, error: "Cannot test webhooks to private or local addresses" });
      }

      // Send a test POST request to the webhook URL
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, 10000); // 10 second timeout

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mailpilot/webhook-test",
            ...headers,
          },
          body: JSON.stringify({
            event: "test",
            timestamp: new Date().toISOString(),
            message: "This is a test webhook from Mailpilot",
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        // Accept 2xx and 3xx status codes as success
        if (response.status >= 200 && response.status < 400) {
          return c.json({ success: true, statusCode: response.status });
        } else {
          return c.json({
            success: false,
            error: `Server returned status ${response.status}`,
            statusCode: response.status,
          });
        }
      } catch (fetchError) {
        clearTimeout(timeout);
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          return c.json({ success: false, error: "Request timed out (10s)" });
        }
        throw fetchError;
      }
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  // Probe IMAP server (no auth required) - detect provider and capabilities
  router.post("/api/probe-imap", requireAuthOrApiKeyWithDryRun("write:accounts"), async (c) => {
    try {
      const body = await c.req.json<{ host: string }>();
      const { host } = body;

      if (!host) {
        return c.json({ success: false, error: "Host is required" });
      }

      // Check if this matches a preset
      const preset = IMAP_PRESETS.find(p => p.host.toLowerCase() === host.toLowerCase());
      const providerInfo = detectImapProvider(host);

      // If preset found, use its known configuration
      const presetPrimaryPort = preset?.ports[0];
      if (preset && presetPrimaryPort) {
        return c.json({
          success: true,
          provider: providerInfo,
          availablePorts: preset.ports,
          suggestedPort: presetPrimaryPort.port,
          suggestedTls: presetPrimaryPort.tls,
          authMethods: preset.oauthSupported ? ["basic", "oauth2"] as const : ["basic"] as const,
          isPreset: true,
          portLocked: true,
        });
      }

      // Probe multiple port/TLS combinations in parallel
      const probeConfigs: { port: number; tls: "tls" | "starttls" | "none" }[] = [
        { port: 993, tls: "tls" },
        { port: 143, tls: "starttls" },
        { port: 143, tls: "none" },
      ];

      const results = await Promise.all(
        probeConfigs.map(config => probeImapPort(host, config.port, config.tls))
      );

      const successfulPorts = results.filter(r => r.success);

      if (successfulPorts.length === 0) {
        // Don't return provider info when we couldn't connect to any port
        // This prevents UI from showing "Generic IMAP detected" for invalid hosts
        return c.json({
          success: false,
          availablePorts: [],
          error: "Could not connect to IMAP server on any standard port (993, 143). Please verify the hostname and try again, or configure the connection manually.",
          portLocked: false,
        });
      }

      // Merge auth methods from all successful probes
      const allAuthMethods = new Set<"basic" | "oauth2">();
      for (const result of successfulPorts) {
        if (result.authMethods) {
          for (const method of result.authMethods) {
            allAuthMethods.add(method);
          }
        }
      }

      // Prefer TLS > STARTTLS > none
      const sortedPorts = successfulPorts.sort((a, b) => {
        const priority = { tls: 0, starttls: 1, none: 2 };
        return priority[a.tls] - priority[b.tls];
      });

      const primary = sortedPorts[0];
      const availablePorts = sortedPorts.map(r => ({ port: r.port, tls: r.tls }));

      // This should never happen since we checked length > 0 above, but TypeScript needs the check
      if (!primary) {
        return c.json({
          success: false,
          provider: providerInfo,
          availablePorts: [],
          error: "Could not determine primary port",
          portLocked: false,
        });
      }

      return c.json({
        success: true,
        provider: providerInfo,
        availablePorts,
        suggestedPort: primary.port,
        suggestedTls: primary.tls,
        authMethods: Array.from(allAuthMethods),
        capabilities: primary.capabilities,
        portLocked: true,
        isPreset: false,
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Invalid request",
      });
    }
  });

  // Test IMAP connection endpoint
  router.post("/api/test-imap", requireAuthOrApiKeyWithDryRun("write:accounts"), async (c) => {
    try {
      const body = await c.req.json<{
        host: string;
        port: number;
        tls: string;
        auth: string;
        username: string;
        password?: string;
        oauth_client_id?: string;
        oauth_client_secret?: string;
        oauth_refresh_token?: string;
        name?: string; // Account name - used to lookup existing credentials if masked
        trusted_tls_fingerprints?: string[]; // Trusted certificate fingerprints
      }>();

      let password = body.password;
      let oauthClientSecret = body.oauth_client_secret;
      let oauthRefreshToken = body.oauth_refresh_token;
      let trustedFingerprints = body.trusted_tls_fingerprints || [];

      // If credentials are masked and we have an account name, look up the real values
      if (body.name) {
        const currentConfig = getCurrentConfig();
        const existingAccount = currentConfig?.accounts.find((a) => a.name === body.name);
        if (existingAccount) {
          if (password === "********") {
            password = existingAccount.imap.password;
          }
          if (oauthClientSecret === "********") {
            oauthClientSecret = existingAccount.imap.oauth_client_secret;
          }
          if (oauthRefreshToken === "********") {
            oauthRefreshToken = existingAccount.imap.oauth_refresh_token;
          }
          // Use existing trusted fingerprints if not provided in request
          if (trustedFingerprints.length === 0 && existingAccount.imap.trusted_tls_fingerprints) {
            trustedFingerprints = existingAccount.imap.trusted_tls_fingerprints;
          }
        }
      }

      // Determine if we need TLS
      const useSecure = body.tls === "tls" || body.tls === "auto";
      const useStarttls = body.tls === "starttls";
      const needsTls = useSecure || useStarttls;

      // For TLS connections, first probe the certificate
      // Note: Skip probe for STARTTLS as it requires IMAP protocol negotiation first
      let certificateInfo: CertificateInfo | undefined;
      if (needsTls && body.tls !== "insecure" && !useStarttls) {
        const tlsProbe = await probeTlsCertificate(body.host, body.port || 993);

        // Log probe result for debugging
        logger.info("TLS probe result", {
          success: tlsProbe.success,
          hasCertInfo: !!tlsProbe.certificateInfo,
          error: tlsProbe.error,
          errorCode: tlsProbe.errorCode,
        });

        if (!tlsProbe.success && tlsProbe.certificateInfo) {
          // Check if this certificate is trusted
          const fingerprint = tlsProbe.certificateInfo.fingerprint256;
          const isTrusted = trustedFingerprints.some(fp =>
            fp.replace(/^sha256:/i, "").toUpperCase() === fingerprint.toUpperCase()
          );

          logger.info("Certificate trust check", {
            fingerprint,
            isTrusted,
            trustedCount: trustedFingerprints.length,
          });

          if (!isTrusted) {
            // Return certificate info so user can choose to trust it
            return c.json({
              success: false,
              error: tlsProbe.error || "Certificate not trusted",
              errorCode: tlsProbe.errorCode,
              certificateInfo: tlsProbe.certificateInfo,
              requiresCertificateTrust: true,
            });
          }
          // Certificate is trusted, continue with connection
          certificateInfo = tlsProbe.certificateInfo;
        } else if (tlsProbe.certificateInfo) {
          certificateInfo = tlsProbe.certificateInfo;
        }
      }

      // Build TLS options
      const tlsOptions: tls.ConnectionOptions = {};
      if (trustedFingerprints.length > 0) {
        // Allow self-signed certs if we have trusted fingerprints
        tlsOptions.rejectUnauthorized = false;
        tlsOptions.checkServerIdentity = (_hostname, cert) => {
          const fingerprint = cert.fingerprint256;
          const isTrusted = trustedFingerprints.some(fp =>
            fp.replace(/^sha256:/i, "").toUpperCase() === fingerprint.toUpperCase()
          );
          if (!isTrusted) {
            return new Error(`Certificate fingerprint ${fingerprint} not in trusted list`);
          }
          return undefined;
        };
      }

      const client = new ImapFlow({
        host: body.host,
        port: body.port || 993,
        secure: useSecure,
        auth: {
          user: body.username,
          pass: password || "",
        },
        logger: false,
        ...(Object.keys(tlsOptions).length > 0 ? { tls: tlsOptions } : {}),
      });

      // Set a timeout for the connection test (use object to track state across async boundary)
      const state = { timedOut: false };
      const timeout = setTimeout(() => {
        state.timedOut = true;
        client.close();
      }, 15000);

      try {
        await client.connect();
        clearTimeout(timeout);

        const capabilities = Array.from(client.capabilities.keys());

        // List all folders
        const folders: string[] = [];
        try {
          const mailboxes = await client.list();
          for (const mailbox of mailboxes) {
            folders.push(mailbox.path);
          }
        } catch {
          // Folder listing failed, but connection succeeded
        }

        await client.logout();

        return c.json({
          success: true,
          capabilities,
          folders,
          certificateInfo,
        });
      } catch (error) {
        clearTimeout(timeout);

        // Parse error to provide more descriptive messages
        const errorMessage = error instanceof Error ? error.message : String(error);
        let errorCode = "CONNECTION_FAILED";
        let userFriendlyError = errorMessage;

        if (state.timedOut) {
          errorCode = "TIMEOUT";
          userFriendlyError = "Connection timed out after 15 seconds. Check if the host and port are correct and the server is reachable.";
        } else if (errorMessage.includes("self-signed") || errorMessage.includes("SELF_SIGNED")) {
          // Self-signed certificate error - try to get certificate info
          errorCode = "SELF_SIGNED_CERT";
          userFriendlyError = "Server uses a self-signed certificate. You can choose to trust this certificate.";

          // Try to probe the certificate now that we know it's a cert error
          try {
            const certProbe = await probeTlsCertificate(body.host, body.port || 993);
            if (certProbe.certificateInfo) {
              // Check if already trusted
              const fingerprint = certProbe.certificateInfo.fingerprint256;
              const isTrusted = trustedFingerprints.some(fp =>
                fp.replace(/^sha256:/i, "").toUpperCase() === fingerprint.toUpperCase()
              );

              if (!isTrusted) {
                return c.json({
                  success: false,
                  error: userFriendlyError,
                  errorCode,
                  certificateInfo: certProbe.certificateInfo,
                  requiresCertificateTrust: true,
                  rawError: errorMessage,
                });
              }
            }
          } catch (probeError) {
            logger.warn("Failed to probe certificate after self-signed error", { probeError });
          }
        } else if (errorMessage.includes("certificate") || errorMessage.includes("CERT_")) {
          errorCode = "CERTIFICATE_ERROR";
          userFriendlyError = `Certificate error: ${errorMessage}`;
        } else if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("getaddrinfo")) {
          errorCode = "HOST_NOT_FOUND";
          userFriendlyError = `Could not resolve hostname "${body.host}". Check if the hostname is correct.`;
        } else if (errorMessage.includes("ECONNREFUSED")) {
          errorCode = "CONNECTION_REFUSED";
          userFriendlyError = `Connection refused by ${body.host}:${body.port}. Check if the server is running and the port is correct.`;
        } else if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("timed out")) {
          errorCode = "TIMEOUT";
          userFriendlyError = "Connection timed out. The server may be unreachable or blocked by a firewall.";
        } else if (errorMessage.includes("Invalid credentials") || errorMessage.includes("Authentication failed") || errorMessage.includes("AUTHENTICATIONFAILED")) {
          errorCode = "AUTH_FAILED";
          userFriendlyError = "Authentication failed. Check your username and password.";
        } else if (errorMessage.includes("NO [ALERT]")) {
          errorCode = "AUTH_FAILED";
          userFriendlyError = `Authentication error: ${errorMessage.replace(/.*NO \[ALERT\]\s*/, "")}`;
        } else if (errorMessage.includes("Unexpected close")) {
          errorCode = "UNEXPECTED_CLOSE";
          userFriendlyError = "Server closed connection unexpectedly. This may be due to TLS/SSL configuration issues or server-side restrictions.";
        }

        return c.json({
          success: false,
          error: userFriendlyError,
          errorCode,
          rawError: errorMessage,
        });
      }
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Invalid request",
        errorCode: "INVALID_REQUEST",
      });
    }
  });

  // Config read endpoint (masks sensitive values)
  router.get("/api/config", requireAuthOrApiKeyWithDryRun("read:stats"), (c) => {
    const currentConfig = getCurrentConfig();
    if (!currentConfig) {
      return c.json({ error: "Config not loaded" }, 500);
    }

    // Deep clone to avoid mutating original
    const safeConfig = JSON.parse(JSON.stringify(currentConfig)) as Config;

    // Mask sensitive fields in accounts
    for (const account of safeConfig.accounts) {
      if (account.imap.password) {
        account.imap.password = "********";
      }
      if (account.imap.oauth_client_secret) {
        account.imap.oauth_client_secret = "********";
      }
      if (account.imap.oauth_refresh_token) {
        account.imap.oauth_refresh_token = "********";
      }
    }

    // Mask API keys in providers
    for (const provider of safeConfig.llm_providers) {
      if (provider.api_key) {
        provider.api_key = "********";
      }
    }

    // Mask dashboard API keys
    if (safeConfig.dashboard?.api_keys) {
      for (const key of safeConfig.dashboard.api_keys) {
        key.key = "********";
      }
    }

    return c.json({ config: safeConfig, configPath });
  });

  // Raw YAML config endpoint - returns file content with secrets masked
  router.get("/api/config/raw", requireAuthOrApiKeyWithDryRun("write:accounts"), (c) => {
    if (!configPath) {
      return c.json({ error: "Config path not set" }, 500);
    }

    try {
      const yamlContent = readFileSync(configPath, "utf-8");

      // Parse YAML, mask sensitive values, and re-serialize
      // This properly handles multi-account configs and values with special characters
      const parsedConfig = yamlParse(yamlContent) as unknown;
      const maskedConfig = maskSensitiveConfig(parsedConfig);
      const maskedYaml = yamlStringify(maskedConfig, { lineWidth: 0 });

      return c.json({ yaml: maskedYaml, configPath });
    } catch (error) {
      return c.json({
        error: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  // Raw YAML config save endpoint
  router.put("/api/config/raw", requireAuthOrApiKeyWithDryRun("write:accounts"), async (c) => {
    if (!configPath) {
      return c.json({ error: "Config path not set" }, 500);
    }

    try {
      const body = await c.req.json<{ yaml: string; reload?: boolean }>();
      const { yaml: inputYaml } = body;
      const reload = body.reload ?? true;

      // Parse the submitted YAML (may contain masked values)
      const submittedConfig = yamlParse(inputYaml) as unknown;

      // Read and parse the original config file
      const originalYaml = readFileSync(configPath, "utf-8");
      const originalConfig = yamlParse(originalYaml) as unknown;

      // Restore masked values by traversing both configs in parallel
      // This correctly handles multi-account configs where each account has its own password
      const restoredConfig = restoreSensitiveConfig(submittedConfig, originalConfig);

      // Serialize back to YAML
      const finalYaml = yamlStringify(restoredConfig, { lineWidth: 0 });

      // Write to file
      writeFileSync(configPath, finalYaml, "utf-8");

      // Optionally reload config
      if (reload) {
        const reloadResult = await reloadConfig();
        return c.json({ success: true, reloadResult });
      }

      return c.json({ success: true });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  // Config write endpoint
  router.put("/api/config", requireAuthOrApiKeyWithDryRun("write:accounts"), async (c) => {
    if (!configPath) {
      return c.json({ error: "Config path not set" }, 500);
    }

    try {
      const body = await c.req.json<{ config: unknown; reload?: boolean }>();
      const { config: newConfig, reload = true } = body;

      // Preserve masked passwords from current config
      const currentConfig = getCurrentConfig();
      const configToSave = newConfig as Config;

      if (currentConfig) {
        // Preserve account passwords
        for (const account of configToSave.accounts) {
          const existingAccount = currentConfig.accounts.find((a) => a.name === account.name);
          if (existingAccount) {
            if (account.imap.password === "********") {
              account.imap.password = existingAccount.imap.password;
            }
            if (account.imap.oauth_client_secret === "********") {
              account.imap.oauth_client_secret = existingAccount.imap.oauth_client_secret;
            }
            if (account.imap.oauth_refresh_token === "********") {
              account.imap.oauth_refresh_token = existingAccount.imap.oauth_refresh_token;
            }
          }
        }

        // Preserve provider API keys
        for (const provider of configToSave.llm_providers) {
          const existingProvider = currentConfig.llm_providers.find((p) => p.name === provider.name);
          if (existingProvider && provider.api_key === "********") {
            provider.api_key = existingProvider.api_key;
          }
        }

        // Preserve dashboard API keys
        if (configToSave.dashboard?.api_keys && currentConfig.dashboard?.api_keys) {
          for (const apiKey of configToSave.dashboard.api_keys) {
            const existingKey = currentConfig.dashboard.api_keys.find((k) => k.name === apiKey.name);
            if (existingKey && apiKey.key === "********") {
              apiKey.key = existingKey.key;
            }
          }
        }
      }

      // Write config to file
      const yamlContent = yamlStringify(configToSave, { lineWidth: 0 });
      writeFileSync(configPath, yamlContent, "utf-8");

      // Optionally reload config
      if (reload) {
        const reloadResult = await reloadConfig();
        return c.json({ success: true, reloadResult });
      }

      return c.json({ success: true });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  // Service health endpoint (Tika, ClamAV)
  router.get("/api/services", requireAuthOrApiKeyWithDryRun("read:stats"), async (c) => {
    const currentConfig = getCurrentConfig();
    const services: Record<string, { enabled: boolean; healthy: boolean; url?: string }> = {};

    // Check Tika
    if (currentConfig?.attachments?.enabled) {
      const tikaClient = createTikaClient(currentConfig.attachments);
      const tikaHealthy = await tikaClient.isHealthy();
      services.tika = {
        enabled: true,
        healthy: tikaHealthy,
        url: currentConfig.attachments.tika_url ?? "http://localhost:9998",
      };
    } else {
      services.tika = { enabled: false, healthy: false };
    }

    // Check ClamAV
    if (currentConfig?.antivirus?.enabled) {
      const scanner = createAntivirusScanner(currentConfig.antivirus);
      const clamHealthy = await scanner.ping();
      services.clamav = {
        enabled: true,
        healthy: clamHealthy,
        url: `${currentConfig.antivirus.host}:${currentConfig.antivirus.port}`,
      };
    } else {
      services.clamav = { enabled: false, healthy: false };
    }

    return c.json(services);
  });

  // Comprehensive health check endpoint (includes LLM providers and IMAP accounts)
  router.get("/api/health-check", requireAuthOrApiKeyWithDryRun("read:stats"), async (c) => {
    const currentConfig = getCurrentConfig();
    const checkLlm = c.req.query("llm") === "true";

    // Infrastructure services
    const services: Record<string, { enabled: boolean; healthy: boolean; url?: string }> = {};

    if (currentConfig?.attachments?.enabled) {
      const tikaClient = createTikaClient(currentConfig.attachments);
      const tikaHealthy = await tikaClient.isHealthy();
      services.tika = {
        enabled: true,
        healthy: tikaHealthy,
        url: currentConfig.attachments.tika_url ?? "http://localhost:9998",
      };
    } else {
      services.tika = { enabled: false, healthy: false };
    }

    if (currentConfig?.antivirus?.enabled) {
      const scanner = createAntivirusScanner(currentConfig.antivirus);
      const clamHealthy = await scanner.ping();
      services.clamav = {
        enabled: true,
        healthy: clamHealthy,
        url: `${currentConfig.antivirus.host}:${currentConfig.antivirus.port}`,
      };
    } else {
      services.clamav = { enabled: false, healthy: false };
    }

    // LLM provider health (only if explicitly requested - makes actual API calls)
    const llmProviders: Array<{ name: string; model: string; url: string; healthy: boolean; error?: string }> = [];
    if (checkLlm) {
      const providers = getAllProviders();
      for (const provider of providers) {
        const result = await testLlmConnection(provider, provider.default_model);
        // Persist health status so it shows on overview page
        updateProviderHealth(provider.name, result.success);
        llmProviders.push({
          name: provider.name,
          model: provider.default_model,
          url: provider.api_url,
          healthy: result.success,
          ...(result.error ? { error: result.error } : {}),
        });
      }

      // Broadcast updated stats to all WebSocket clients so Overview page updates
      broadcastCurrentStats();
    }

    // IMAP account status (uses existing connection status)
    const accounts = getAccountStatuses();
    const imapAccounts = accounts.map((a) => ({
      name: a.name,
      connected: a.connected,
      idleSupported: a.idleSupported,
      lastScan: a.lastScan,
      errors: a.errors,
    }));

    return c.json({
      services,
      llmProviders,
      imapAccounts,
    });
  });

  // Dead letter queue endpoints
  router.get("/api/dead-letter", requireAuthOrApiKeyWithDryRun("read:activity"), (c) => {
    const accountName = c.req.query("accountName");
    const entries = getDeadLetterEntries(accountName);
    return c.json({
      entries,
      total: entries.length,
    });
  });

  router.post("/api/dead-letter/:id/retry", requireAuthOrApiKeyWithDryRun("write:accounts"), (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid ID" }, 400);
    }

    // Mark as resolved (the actual retry will happen when the email is processed again)
    const success = resolveDeadLetter(id);
    return c.json({ success });
  });

  router.post("/api/dead-letter/:id/dismiss", requireAuthOrApiKeyWithDryRun("write:accounts"), (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid ID" }, 400);
    }

    const success = removeDeadLetter(id);
    return c.json({ success });
  });

  router.post("/api/dead-letter/:id/skip", requireAuthOrApiKeyWithDryRun("write:accounts"), (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid ID" }, 400);
    }

    const success = skipDeadLetter(id);
    return c.json({ success });
  });

  // Email preview endpoint
  router.get("/api/emails/:account/:folder/:uid", requireAuthOrApiKeyWithDryRun("read:activity"), async (c) => {
    const accountName = c.req.param("account");
    const folder = c.req.param("folder");
    const uid = parseInt(c.req.param("uid"), 10);

    if (isNaN(uid)) {
      return c.json({ error: "Invalid UID" }, 400);
    }

    const client = getAccountClient(accountName);
    if (!client) {
      return c.json({ error: "Account not found or not connected" }, 404);
    }

    try {
      const email = await fetchAndParseEmail(client.client, folder, uid);

      // Truncate body for preview (first 2000 chars)
      const truncatedBody = email.body.length > 2000
        ? email.body.substring(0, 2000) + "..."
        : email.body;

      return c.json({
        messageId: email.messageId,
        from: email.from,
        subject: email.subject,
        date: email.date,
        body: truncatedBody,
        attachments: email.attachments.map((a) => ({
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
        })),
      });
    } catch (error) {
      return c.json({
        error: "Failed to fetch email",
        message: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  return router;
}
