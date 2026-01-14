import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { ServerConfig, AccountConfig } from "../config/schema.js";
import { createLogger } from "../utils/logger.js";
import { healthRouter } from "./health.js";
import {
  createStatusRouter,
  initializeAccountStatuses,
} from "./status.js";

const logger = createLogger("server");

let server: ReturnType<typeof serve> | null = null;

export function startServer(
  serverConfig: ServerConfig,
  accounts: AccountConfig[]
): void {
  const app = new Hono();

  initializeAccountStatuses(accounts);

  app.route("/", healthRouter);
  app.route("/", createStatusRouter(serverConfig));

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

export async function stopServer(): Promise<void> {
  if (server) {
    server.close();
    server = null;
    logger.info("HTTP server stopped");
  }
}

export { updateAccountStatus, incrementAccountErrors } from "./status.js";
