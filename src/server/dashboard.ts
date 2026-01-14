import { Hono, type Context } from "hono";
import type { DashboardConfig, ApiKeyPermission, Config } from "../config/schema.js";
import {
  getUserCount,
  createUser,
  verifyPassword,
  createSession,
  deleteSession,
} from "../storage/dashboard.js";
import { getProcessedCount } from "../storage/processed.js";
import {
  getActionCount,
  getActionBreakdown,
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
import { getRecentLogs, type LogLevel } from "../utils/logger.js";
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
import { writeFileSync } from "node:fs";
import { stringify as yamlStringify } from "yaml";
import { fetchAndParseEmail } from "../processor/email.js";
import {
  getDeadLetterEntries,
  getDeadLetterCount,
  resolveDeadLetter,
  removeDeadLetter,
} from "../storage/dead-letter.js";
import { createTikaClient } from "../attachments/tika.js";
import { createAntivirusScanner } from "../processor/antivirus.js";

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
        emailsProcessed: getProcessedCount(),
        actionsTaken: getActionCount(),
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
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const search = c.req.query("search");

    if (accountName) filters.accountName = accountName;
    if (actionType) filters.actionType = actionType;
    if (startDate) filters.startDate = parseInt(startDate, 10);
    if (endDate) filters.endDate = parseInt(endDate, 10);
    if (search) filters.search = search;

    return c.json(getAuditEntriesPaginated(page, pageSize, filters));
  });

  router.get("/api/logs", requireAuthOrApiKeyWithDryRun("read:logs"), (c) => {
    const limit = parseInt(c.req.query("limit") ?? "100", 10);
    const levelFilter = c.req.query("level") as LogLevel | undefined;
    const accountName = c.req.query("accountName");

    let logs = getRecentLogs(limit, levelFilter);

    // Filter by account if specified
    if (accountName) {
      logs = logs.filter((log) => {
        const contextStr = JSON.stringify(log.meta ?? {});
        return contextStr.includes(accountName);
      });
    }

    return c.json({ logs });
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

    return c.json({ success, paused: success ? true : isAccountPaused(name) });
  });

  router.post("/api/accounts/:name/resume", requireAuthOrApiKeyWithDryRun("write:accounts"), (c) => {
    const name = c.req.param("name");
    const success = resumeAccount(name);

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

  // Config write endpoint
  router.put("/api/config", requireAuthOrApiKeyWithDryRun("write:accounts"), async (c) => {
    if (!configPath) {
      return c.json({ error: "Config path not set" }, 500);
    }

    try {
      const body = await c.req.json<{ config: unknown; reload?: boolean }>();
      const { config: newConfig, reload = true } = body;

      // Write config to file
      const yamlContent = yamlStringify(newConfig, { lineWidth: 0 });
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
      const pausedAccountsList = getPausedAccounts();
      const allAccounts = getAccountStatuses();
      broadcastStats({
        version: getVersion(),
        uptime: getUptime(),
        dryRun: currentConfig?.dry_run ?? dryRun,
        totals: {
          emailsProcessed: getProcessedCount(),
          actionsTaken: getActionCount(),
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
