import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import type { ServerConfig, AccountConfig, DashboardConfig } from "../config/schema.js";
import { createLogger, setLogsBroadcast } from "../utils/logger.js";
import { healthRouter } from "./health.js";
import {
  createStatusRouter,
  initializeAccountStatuses,
  setAccountUpdateBroadcast,
} from "./status.js";
import { createDashboardRouter } from "./dashboard.js";
import { getUserCount, cleanupExpiredSessions } from "../storage/dashboard.js";
import {
  initWebSocketServer,
  handleUpgrade,
  closeAllConnections,
  broadcastActivity,
  broadcastLogs,
  broadcastAccountUpdate,
} from "./websocket.js";
import { setApiKeys } from "./auth.js";
import { setActivityBroadcast } from "../storage/audit.js";

const logger = createLogger("server");

let server: ReturnType<typeof serve> | null = null;
let warningInterval: ReturnType<typeof setInterval> | null = null;
let sessionCleanupInterval: ReturnType<typeof setInterval> | null = null;

const WARNING_INTERVAL_MS = 4 * 60 * 60 * 1000;
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

function checkDashboardWarning(): void {
  if (getUserCount() === 0) {
    logger.warn("SECURITY WARNING: Dashboard enabled but no admin account exists");
    logger.warn("Anyone can register at /setup - create an account immediately");
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
    // Initialize API keys for auth
    setApiKeys(dashboardConfig.api_keys);

    // Initialize WebSocket server
    initWebSocketServer(dashboardConfig);
    logger.info("WebSocket server initialized");

    // Set up broadcast functions
    setActivityBroadcast(broadcastActivity);
    setLogsBroadcast(broadcastLogs);
    setAccountUpdateBroadcast(broadcastAccountUpdate);

    // Serve static dashboard files
    app.use("/assets/*", serveStatic({ root: "./dist/dashboard" }));
    app.get("/favicon.ico", serveStatic({ path: "./dist/dashboard/favicon.ico" }));

    // Dashboard router (API endpoints)
    app.route("/", createDashboardRouter(dashboardConfig));

    // SPA fallback - serve index.html for dashboard routes
    app.get("/", serveStatic({ path: "./dist/dashboard/index.html" }));
    app.get("/login", serveStatic({ path: "./dist/dashboard/index.html" }));
    app.get("/setup", serveStatic({ path: "./dist/dashboard/index.html" }));

    logger.info("Dashboard enabled", { path: "/" });

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

      // Handle WebSocket upgrade
      if (dashboardConfig?.enabled && server) {
        const httpServer = (server as unknown as { server?: { on: (event: string, handler: (...args: unknown[]) => void) => void } }).server;
        if (httpServer) {
          httpServer.on("upgrade", (request: unknown, socket: unknown, head: unknown) => {
            const req = request as import("node:http").IncomingMessage;
            if (req.url === "/ws") {
              handleUpgrade(req, socket as import("node:stream").Duplex, head as Buffer);
            }
          });
          logger.info("WebSocket upgrade handler registered", { path: "/ws" });
        }
      }
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

  // Close WebSocket connections
  closeAllConnections();

  if (server) {
    server.close();
    server = null;
    logger.info("HTTP server stopped");
  }
}

export { updateAccountStatus, incrementAccountErrors } from "./status.js";
