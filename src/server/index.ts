import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { ServerConfig, AccountConfig, DashboardConfig } from "../config/schema.js";
import { createLogger } from "../utils/logger.js";
import { healthRouter } from "./health.js";
import {
  createStatusRouter,
  initializeAccountStatuses,
} from "./status.js";
import { createDashboardRouter } from "./dashboard.js";
import { getUserCount, cleanupExpiredSessions } from "../storage/dashboard.js";

const logger = createLogger("server");

let server: ReturnType<typeof serve> | null = null;
let warningInterval: ReturnType<typeof setInterval> | null = null;
let sessionCleanupInterval: ReturnType<typeof setInterval> | null = null;

const WARNING_INTERVAL_MS = 4 * 60 * 60 * 1000;
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

function checkDashboardWarning(): void {
  if (getUserCount() === 0) {
    logger.warn("SECURITY WARNING: Dashboard enabled but no admin account exists");
    logger.warn("Anyone can register at /dashboard/setup - create an account immediately");
  }
}

export function startServer(
  serverConfig: ServerConfig,
  accounts: AccountConfig[],
  dashboardConfig?: DashboardConfig
): void {
  const app = new Hono();

  initializeAccountStatuses(accounts);

  app.route("/", healthRouter);
  app.route("/", createStatusRouter(serverConfig));

  if (dashboardConfig?.enabled) {
    app.route("/", createDashboardRouter(dashboardConfig));
    logger.info("Dashboard enabled", { path: "/dashboard" });

    checkDashboardWarning();

    warningInterval = setInterval(checkDashboardWarning, WARNING_INTERVAL_MS);

    sessionCleanupInterval = setInterval(() => {
      cleanupExpiredSessions();
    }, SESSION_CLEANUP_INTERVAL_MS);
  }

  server = serve(
    {
      fetch: app.fetch,
      port: serverConfig.port,
    },
    (info) => {
      logger.info("HTTP server started", { port: info.port });
    }
  );
}

export function stopServer(): void {
  if (warningInterval) {
    clearInterval(warningInterval);
    warningInterval = null;
  }

  if (sessionCleanupInterval) {
    clearInterval(sessionCleanupInterval);
    sessionCleanupInterval = null;
  }

  if (server) {
    server.close();
    server = null;
    logger.info("HTTP server stopped");
  }
}

export { updateAccountStatus, incrementAccountErrors } from "./status.js";
