import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import type { ServerConfig, AccountConfig, DashboardConfig, AttachmentsConfig, AntivirusConfig } from "../config/schema.js";
import { createLogger, setLogsBroadcast } from "../utils/logger.js";
import { healthRouter, setHealthConfig } from "./health.js";
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

// Helper to start server with retry on EADDRINUSE (handles hot-reload gracefully)
// On Windows, ports can be held for 30-240 seconds in TIME_WAIT state
async function serveWithRetry(
  options: Parameters<typeof serve>[0],
  callback: Parameters<typeof serve>[1],
  maxRetries = 15,
  delayMs = 500
): Promise<ReturnType<typeof serve>> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create a promise that resolves on success or rejects on EADDRINUSE
      const result = await new Promise<ReturnType<typeof serve>>((resolve, reject) => {
        const srv = serve(options, (info) => {
          // Server started successfully
          callback?.(info);
          resolve(srv);
        });

        // Handle EADDRINUSE error
        srv.on("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "EADDRINUSE") {
            srv.close();
            reject(err);
          }
        });
      });
      return result;
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === "EADDRINUSE" && attempt < maxRetries) {
        logger.debug(`Port ${options.port} in use, retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delayMs));
        delayMs *= 1.5; // Exponential backoff
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Failed to start server after ${maxRetries} attempts`);
}

let server: ReturnType<typeof serve> | null = null;
let warningInterval: ReturnType<typeof setInterval> | null = null;
let sessionCleanupInterval: ReturnType<typeof setInterval> | null = null;
// Track active connections for graceful shutdown
const activeConnections = new Set<import("node:net").Socket>();

const WARNING_INTERVAL_MS = 4 * 60 * 60 * 1000;
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

function checkDashboardWarning(): void {
  if (getUserCount() === 0) {
    logger.warn("SECURITY WARNING: Dashboard enabled but no admin account exists");
    logger.warn("Anyone can register at /setup - create an account immediately");
  }
}

export interface StartServerOptions {
  serverConfig: ServerConfig;
  accounts: AccountConfig[];
  dashboardConfig?: DashboardConfig;
  attachmentsConfig?: AttachmentsConfig;
  antivirusConfig?: AntivirusConfig;
  dryRun?: boolean;
  configPath?: string;
}

export async function startServer(
  serverConfig: ServerConfig,
  accounts: AccountConfig[],
  dashboardConfig?: DashboardConfig,
  attachmentsConfig?: AttachmentsConfig,
  antivirusConfig?: AntivirusConfig,
  dryRun = false,
  configPath?: string
): Promise<void> {
  const app = new Hono();

  initializeAccountStatuses(accounts);

  // Set health config for /health endpoint
  setHealthConfig({
    ...(attachmentsConfig && { attachments: attachmentsConfig }),
    ...(antivirusConfig && { antivirus: antivirusConfig }),
  });

  app.route("/", healthRouter);
  app.route("/", createStatusRouter(serverConfig));

  if (dashboardConfig?.enabled) {
    // Initialize API keys for auth
    setApiKeys(dashboardConfig.api_keys);

    // Initialize WebSocket server
    initWebSocketServer(dashboardConfig, dryRun);
    logger.info("WebSocket server initialized", { dryRun });

    // Set up broadcast functions
    setActivityBroadcast(broadcastActivity);
    setLogsBroadcast(broadcastLogs);
    setAccountUpdateBroadcast(broadcastAccountUpdate);

    // Serve static dashboard files
    app.use("/assets/*", serveStatic({ root: "./dist/dashboard" }));
    app.get("/favicon.ico", serveStatic({ path: "./dist/dashboard/favicon.ico" }));

    // Dashboard router (API endpoints)
    app.route("/", createDashboardRouter({
      dashboardConfig,
      dryRun,
      ...(configPath && { configPath }),
    }));

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

  server = await serveWithRetry(
    {
      fetch: app.fetch,
      port: serverConfig.port,
    },
    (info) => {
      logger.info("HTTP server started", { port: info.port });
    }
  );

  // Track connections for graceful shutdown
  server.on("connection", (socket: import("node:net").Socket) => {
    activeConnections.add(socket);
    socket.on("close", () => {
      activeConnections.delete(socket);
    });
  });

  // Handle WebSocket upgrade
  if (dashboardConfig?.enabled) {
    server.on("upgrade", (request: unknown, socket: unknown, head: unknown) => {
      const req = request as import("node:http").IncomingMessage;
      if (req.url === "/ws") {
        handleUpgrade(req, socket as import("node:stream").Duplex, head as Buffer);
      }
    });
    logger.info("WebSocket upgrade handler registered", { path: "/ws" });
  }
}

export async function stopServer(): Promise<void> {
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

  // Force-close all active HTTP connections
  for (const socket of activeConnections) {
    socket.destroy();
  }
  activeConnections.clear();

  if (server) {
    const srv = server;
    // Force-close all idle connections immediately (Node.js 18.2+)
    // Cast to http.Server to access closeAllConnections which exists but isn't in Hono's types
    const httpServer = srv as import("node:http").Server;
    if (typeof httpServer.closeAllConnections === "function") {
      httpServer.closeAllConnections();
    }
    await new Promise<void>((resolve) => {
      srv.close(() => {
        resolve();
      });
    });
    server = null;
    logger.info("HTTP server stopped");
  }
}

export { updateAccountStatus, incrementAccountErrors } from "./status.js";
