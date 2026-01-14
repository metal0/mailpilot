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
import { getActionCount, getAuditEntries } from "../storage/audit.js";
import {
  createSessionMiddleware,
  getAuthContext,
  setSessionCookie,
  clearSessionCookie,
} from "./auth.js";
import {
  renderSetupPage,
  renderLoginPage,
  renderDashboard,
} from "./templates.js";
import { getAccountStatuses, getUptime } from "./status.js";

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
    return c.html(renderSetupPage());
  });

  router.post("/dashboard/setup", async (c) => {
    if (getUserCount() > 0) {
      return c.json({ error: "Setup already completed" }, 403);
    }

    const body = await c.req.parseBody();
    const username = body["username"] as string;
    const password = body["password"] as string;
    const confirm = body["confirm"] as string;

    if (!username || username.length < 3) {
      return c.html(renderSetupPage("Username must be at least 3 characters"));
    }

    if (!password || password.length < 8) {
      return c.html(renderSetupPage("Password must be at least 8 characters"));
    }

    if (password !== confirm) {
      return c.html(renderSetupPage("Passwords do not match"));
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

    return c.html(renderLoginPage());
  });

  router.post("/dashboard/login", async (c) => {
    if (getUserCount() === 0) {
      return c.redirect("/dashboard/setup");
    }

    const body = await c.req.parseBody();
    const username = body["username"] as string;
    const password = body["password"] as string;

    if (!username || !password) {
      return c.html(renderLoginPage("Please enter username and password"));
    }

    const user = await verifyPassword(username, password);
    if (!user) {
      return c.html(renderLoginPage("Invalid username or password"));
    }

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

  return router;
}
