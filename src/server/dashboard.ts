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
import { stringify as yamlStringify } from "yaml";
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
import * as net from "node:net";
import * as tls from "node:tls";

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

interface ImapProviderInfo {
  name: string;
  type: "gmail" | "outlook" | "yahoo" | "icloud" | "fastmail" | "generic";
  requiresOAuth: boolean;
  oauthSupported: boolean;
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

interface PortProbeResult {
  port: number;
  tls: "tls" | "starttls" | "none";
  success: boolean;
  capabilities?: string[];
  authMethods?: ("basic" | "oauth2")[];
}

async function probeImapPort(
  host: string,
  port: number,
  tlsMode: "tls" | "starttls" | "none",
  timeoutMs = 5000
): Promise<PortProbeResult> {
  return new Promise((resolve) => {
    let socket: net.Socket | tls.TLSSocket | undefined;
    let resolved = false;
    let dataBuffer = "";
    let capabilities: string[] = [];
    let greetingReceived = false;
    let starttlsSent = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        try { socket?.destroy(); } catch { /* ignore */ }
      }
    };

    const finishSuccess = () => {
      clearTimeout(timeout);
      cleanup();
      const authMethods: ("basic" | "oauth2")[] = ["basic"];
      if (capabilities.some(cap => cap.toUpperCase().includes("AUTH=XOAUTH2"))) {
        authMethods.push("oauth2");
      }
      resolve({ port, tls: tlsMode, success: true, capabilities, authMethods });
    };

    const finishFailure = () => {
      clearTimeout(timeout);
      cleanup();
      resolve({ port, tls: tlsMode, success: false });
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ port, tls: tlsMode, success: false });
    }, timeoutMs);

    const parseCapabilities = (data: string) => {
      // Parse capabilities from greeting or CAPABILITY response
      const capMatch = data.match(/\[CAPABILITY ([^\]]+)\]/i) || data.match(/\* CAPABILITY (.+)/i);
      if (capMatch?.[1]) {
        capabilities = capMatch[1].split(" ").filter(c => c.length > 0);
      }
    };

    const handleData = (data: Buffer) => {
      dataBuffer += data.toString();

      // Check for IMAP greeting
      if (!greetingReceived && (dataBuffer.includes("* OK") || dataBuffer.includes("* PREAUTH"))) {
        greetingReceived = true;
        parseCapabilities(dataBuffer);

        if (tlsMode === "tls" || tlsMode === "none") {
          // For TLS mode, we already connected via TLS - success
          // For none/insecure mode, plaintext connection works - success
          finishSuccess();
          return;
        }

        // For STARTTLS mode, check if server supports it and try to upgrade
        // At this point, tlsMode must be "starttls" (tls and none already handled above)
        const hasStarttls = capabilities.some(c => c.toUpperCase() === "STARTTLS");
        if (!hasStarttls) {
          // Server doesn't support STARTTLS
          finishFailure();
          return;
        }
        // Send STARTTLS command
        starttlsSent = true;
        socket?.write("A001 STARTTLS\r\n");
      }

      // Handle STARTTLS response
      if (starttlsSent && dataBuffer.includes("A001 OK")) {
        // Server accepted STARTTLS, now upgrade to TLS
        const plainSocket = socket as net.Socket;
        const tlsSocket = tls.connect({
          socket: plainSocket,
          host,
          rejectUnauthorized: false,
        }, () => {
          // TLS upgrade successful
          finishSuccess();
        });
        tlsSocket.on("error", finishFailure);
        socket = tlsSocket;
      } else if (starttlsSent && (dataBuffer.includes("A001 NO") || dataBuffer.includes("A001 BAD"))) {
        // STARTTLS command failed
        finishFailure();
      }
    };

    const handleError = () => {
      finishFailure();
    };

    try {
      if (tlsMode === "tls") {
        // Connect directly with TLS
        socket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
          // TLS handshake successful, wait for IMAP greeting
        });
      } else {
        // Connect via plain TCP (for both starttls and none modes)
        socket = net.connect({ host, port }, () => {
          // TCP connection established, wait for IMAP greeting
        });
      }

      socket.on("data", handleData);
      socket.on("error", handleError);
      socket.on("close", () => {
        if (!resolved) {
          finishFailure();
        }
      });
    } catch {
      finishFailure();
    }
  });
}

function detectImapProvider(host: string): ImapProviderInfo {
  const hostLower = host.toLowerCase();

  if (hostLower.includes("gmail") || hostLower.includes("google")) {
    return {
      name: "Gmail",
      type: "gmail",
      requiresOAuth: false, // App passwords work
      oauthSupported: true,
    };
  }

  if (hostLower.includes("outlook") || hostLower.includes("office365") || hostLower.includes("microsoft")) {
    return {
      name: "Microsoft Outlook",
      type: "outlook",
      requiresOAuth: false, // App passwords work for personal accounts
      oauthSupported: true,
    };
  }

  if (hostLower.includes("yahoo")) {
    return {
      name: "Yahoo Mail",
      type: "yahoo",
      requiresOAuth: false,
      oauthSupported: true,
    };
  }

  if (hostLower.includes("icloud") || hostLower.includes("apple") || hostLower.includes("me.com")) {
    return {
      name: "iCloud Mail",
      type: "icloud",
      requiresOAuth: false, // App-specific passwords
      oauthSupported: false,
    };
  }

  if (hostLower.includes("fastmail")) {
    return {
      name: "Fastmail",
      type: "fastmail",
      requiresOAuth: false,
      oauthSupported: false,
    };
  }

  return {
    name: "Generic IMAP",
    type: "generic",
    requiresOAuth: false,
    oauthSupported: false,
  };
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

      const success = await testLlmConnection(testProvider, default_model);

      return c.json({
        success,
        error: success ? undefined : "Failed to connect to LLM provider. Check your API key and URL.",
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

      // Send a test POST request to the webhook URL
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

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
        return c.json({
          success: false,
          provider: providerInfo,
          availablePorts: [],
          error: "Could not connect to IMAP server on any standard port",
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
      }>();

      let password = body.password;
      let oauthClientSecret = body.oauth_client_secret;
      let oauthRefreshToken = body.oauth_refresh_token;

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
        }
      }

      const secure = body.tls === "tls" || body.tls === "auto";

      const client = new ImapFlow({
        host: body.host,
        port: body.port || 993,
        secure,
        auth: {
          user: body.username,
          pass: password || "",
        },
        logger: false,
      });

      // Set a timeout for the connection test
      const timeout = setTimeout(() => {
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
        });
      } catch (error) {
        clearTimeout(timeout);
        return c.json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Invalid request",
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

  // Raw YAML config endpoint - returns unmasked file content
  router.get("/api/config/raw", requireAuthOrApiKeyWithDryRun("write:accounts"), (c) => {
    if (!configPath) {
      return c.json({ error: "Config path not set" }, 500);
    }

    try {
      const yamlContent = readFileSync(configPath, "utf-8");
      return c.json({ yaml: yamlContent, configPath });
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
      const { yaml: yamlContent, reload = true } = body;

      // Write raw YAML to file
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
    const llmProviders: Array<{ name: string; model: string; url: string; healthy: boolean }> = [];
    if (checkLlm) {
      const providers = getAllProviders();
      for (const provider of providers) {
        const healthy = await testLlmConnection(provider, provider.default_model);
        // Persist health status so it shows on overview page
        updateProviderHealth(provider.name, healthy);
        llmProviders.push({
          name: provider.name,
          model: provider.default_model,
          url: provider.api_url,
          healthy,
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
