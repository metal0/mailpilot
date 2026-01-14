import { Hono } from "hono";
import type { DashboardConfig } from "../config/schema.js";
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
  getAuditEntries,
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
  validateCsrf,
  getCsrfToken,
} from "./auth.js";
import {
  renderSetupPage,
  renderLoginPage,
  renderDashboard,
} from "./templates.js";
import { getAccountStatuses, getUptime } from "./status.js";
import { getDetailedProviderStats } from "../llm/providers.js";
import { getRecentLogs, type LogLevel } from "../utils/logger.js";
import {
  getQueueStatus,
  pauseAccount,
  resumeAccount,
  isAccountPaused,
  reconnectAccount,
  triggerProcessing,
  getPausedAccounts,
} from "../accounts/manager.js";

export function createDashboardRouter(config: DashboardConfig): Hono {
  const router = new Hono();
  const sessionTtl = config.session_ttl;

  router.use("*", createSessionMiddleware(sessionTtl));

  router.get("/dashboard", (c) => {
    if (getUserCount() === 0) {
      return c.redirect("/dashboard/setup");
    }

    const auth = getAuthContext(c);
    if (!auth) {
      return c.redirect("/dashboard/login");
    }

    const accounts = getAccountStatuses();
    const totals = {
      emailsProcessed: getProcessedCount(),
      actionsTaken: getActionCount(),
      errors: accounts.reduce((sum, a) => sum + a.errors, 0),
    };

    return c.html(
      renderDashboard({
        username: auth.user.username,
        uptime: getUptime(),
        totals,
        accounts,
        recentActivity: getAuditEntries(undefined, 20),
      })
    );
  });

  router.get("/dashboard/setup", (c) => {
    if (getUserCount() > 0) {
      return c.json({ error: "Setup already completed" }, 403);
    }
    const csrfToken = getCsrfToken(c);
    return c.html(renderSetupPage({ csrfToken }));
  });

  router.post("/dashboard/setup", async (c) => {
    if (getUserCount() > 0) {
      return c.json({ error: "Setup already completed" }, 403);
    }

    const body = await c.req.parseBody();
    const username = body["username"] as string;
    const password = body["password"] as string;
    const confirm = body["confirm"] as string;
    const csrfToken = body["_csrf"] as string;

    if (!validateCsrf(c, csrfToken)) {
      return c.html(renderSetupPage({ error: "Invalid request. Please try again.", csrfToken: getCsrfToken(c) }));
    }

    if (!username || username.length < 3) {
      return c.html(renderSetupPage({ error: "Username must be at least 3 characters", csrfToken: getCsrfToken(c) }));
    }

    if (!password || password.length < 8) {
      return c.html(renderSetupPage({ error: "Password must be at least 8 characters", csrfToken: getCsrfToken(c) }));
    }

    if (password !== confirm) {
      return c.html(renderSetupPage({ error: "Passwords do not match", csrfToken: getCsrfToken(c) }));
    }

    const user = await createUser(username, password);
    const session = createSession(user.id, sessionTtl);
    setSessionCookie(c, session.id);

    return c.redirect("/dashboard");
  });

  router.get("/dashboard/login", (c) => {
    if (getUserCount() === 0) {
      return c.redirect("/dashboard/setup");
    }

    const auth = getAuthContext(c);
    if (auth) {
      return c.redirect("/dashboard");
    }

    const csrfToken = getCsrfToken(c);
    return c.html(renderLoginPage({ csrfToken }));
  });

  router.post("/dashboard/login", async (c) => {
    if (getUserCount() === 0) {
      return c.redirect("/dashboard/setup");
    }

    const body = await c.req.parseBody();
    const username = body["username"] as string;
    const password = body["password"] as string;
    const csrfToken = body["_csrf"] as string;

    // CSRF validation
    if (!validateCsrf(c, csrfToken)) {
      return c.html(renderLoginPage({ error: "Invalid request. Please try again.", csrfToken: getCsrfToken(c), username }));
    }

    // Rate limiting
    const rateLimit = checkRateLimit(c);
    if (!rateLimit.allowed) {
      const minutes = Math.ceil((rateLimit.retryAfter ?? 900) / 60);
      return c.html(renderLoginPage({
        error: `Too many login attempts. Try again in ${minutes} minutes.`,
        csrfToken: getCsrfToken(c),
        username,
      }));
    }

    if (!username || !password) {
      return c.html(renderLoginPage({
        error: "Please enter username and password",
        csrfToken: getCsrfToken(c),
        username,
      }));
    }

    const user = await verifyPassword(username, password);
    if (!user) {
      recordFailedLogin(c);
      return c.html(renderLoginPage({
        error: "Invalid username or password",
        csrfToken: getCsrfToken(c),
        username,
      }));
    }

    clearFailedLogins(c);
    const session = createSession(user.id, sessionTtl);
    setSessionCookie(c, session.id);

    return c.redirect("/dashboard");
  });

  router.post("/dashboard/logout", (c) => {
    const auth = getAuthContext(c);
    if (auth) {
      deleteSession(auth.sessionId);
    }
    clearSessionCookie(c);
    return c.redirect("/dashboard/login");
  });

  // API endpoints for AJAX polling
  router.get("/dashboard/api/stats", (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const accounts = getAccountStatuses();
    const pausedAccountsList = getPausedAccounts();

    return c.json({
      uptime: getUptime(),
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
    });
  });

  router.get("/dashboard/api/activity", (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const page = parseInt(c.req.query("page") ?? "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") ?? "20", 10);

    const filters: AuditFilters = {};
    const accountName = c.req.query("accountName");
    const actionType = c.req.query("actionType");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    if (accountName) filters.accountName = accountName;
    if (actionType) filters.actionType = actionType;
    if (startDate) filters.startDate = parseInt(startDate, 10);
    if (endDate) filters.endDate = parseInt(endDate, 10);

    return c.json(getAuditEntriesPaginated(page, pageSize, filters));
  });

  router.get("/dashboard/api/logs", (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const limit = parseInt(c.req.query("limit") ?? "100", 10);
    const levelFilter = c.req.query("level") as LogLevel | undefined;

    return c.json({
      logs: getRecentLogs(limit, levelFilter),
    });
  });

  router.get("/dashboard/api/export", (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const format = c.req.query("format") ?? "json";
    const filters: AuditFilters = {};

    const accountName = c.req.query("accountName");
    const actionType = c.req.query("actionType");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    if (accountName) filters.accountName = accountName;
    if (actionType) filters.actionType = actionType;
    if (startDate) filters.startDate = parseInt(startDate, 10);
    if (endDate) filters.endDate = parseInt(endDate, 10);

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
  router.post("/dashboard/api/accounts/:name/pause", (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const name = c.req.param("name");
    const success = pauseAccount(name);

    return c.json({ success, paused: success ? true : isAccountPaused(name) });
  });

  router.post("/dashboard/api/accounts/:name/resume", (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const name = c.req.param("name");
    const success = resumeAccount(name);

    return c.json({ success, paused: success ? false : isAccountPaused(name) });
  });

  router.post("/dashboard/api/accounts/:name/reconnect", async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const name = c.req.param("name");
    const success = await reconnectAccount(name);

    return c.json({ success });
  });

  router.post("/dashboard/api/accounts/:name/process", async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const name = c.req.param("name");
    const folder = c.req.query("folder") ?? "INBOX";
    const success = await triggerProcessing(name, folder);

    return c.json({ success });
  });

  return router;
}
