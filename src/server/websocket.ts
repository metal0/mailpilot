import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { parse as parseCookie } from "cookie";
import { getSession, getUserById } from "../storage/dashboard.js";
import { createLogger } from "../utils/logger.js";
import type { DashboardConfig, ApiKeyConfig } from "../config/schema.js";

const logger = createLogger("websocket");

export interface WebSocketMessage {
  type: "stats" | "activity" | "logs" | "account_update" | "toast";
  data: unknown;
}

interface AuthenticatedClient {
  ws: WebSocket;
  userId?: number;
  apiKeyName?: string;
}

const clients = new Set<AuthenticatedClient>();
let wss: WebSocketServer | null = null;
let apiKeys: ApiKeyConfig[] = [];

const SESSION_COOKIE = "mailpilot_session";

export function initWebSocketServer(config: DashboardConfig): WebSocketServer {
  wss = new WebSocketServer({ noServer: true });
  apiKeys = config.api_keys;

  wss.on("connection", (ws: WebSocket, _request: IncomingMessage, client: AuthenticatedClient) => {
    clients.add(client);

    const authInfo = client.apiKeyName
      ? `API key: ${client.apiKeyName}`
      : `User ID: ${client.userId}`;
    logger.info("WebSocket client connected", { authInfo, clients: clients.size });

    ws.on("close", () => {
      clients.delete(client);
      logger.debug("WebSocket client disconnected", { clients: clients.size });
    });

    ws.on("error", (error) => {
      logger.error("WebSocket error", { error: error.message });
      clients.delete(client);
    });
  });

  return wss;
}

export function handleUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer
): void {
  if (!wss) {
    socket.destroy();
    return;
  }

  const server = wss;
  const authResult = authenticateRequest(request);

  if (!authResult.authenticated) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    logger.warn("WebSocket connection rejected: unauthorized");
    return;
  }

  server.handleUpgrade(request, socket, head, (ws) => {
    const client: AuthenticatedClient = { ws };
    if (authResult.userId !== undefined) {
      client.userId = authResult.userId;
    }
    if (authResult.apiKeyName !== undefined) {
      client.apiKeyName = authResult.apiKeyName;
    }
    server.emit("connection", ws, request, client);
  });
}

interface AuthResult {
  authenticated: boolean;
  userId?: number;
  apiKeyName?: string;
}

function authenticateRequest(request: IncomingMessage): AuthResult {
  // Try API key auth first (Authorization: Bearer mp_xxx)
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const apiKey = apiKeys.find((k) => k.key === token);
    if (apiKey) {
      return { authenticated: true, apiKeyName: apiKey.name };
    }
  }

  // Try session cookie auth
  const cookieHeader = request.headers.cookie;
  if (cookieHeader) {
    const cookies = parseCookie(cookieHeader);
    const sessionId = cookies[SESSION_COOKIE];
    if (sessionId) {
      const session = getSession(sessionId);
      if (session) {
        const user = getUserById(session.userId);
        if (user) {
          return { authenticated: true, userId: user.id };
        }
      }
    }
  }

  return { authenticated: false };
}

export function broadcast(message: WebSocketMessage): void {
  if (clients.size === 0) return;

  const payload = JSON.stringify(message);
  let sent = 0;

  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
      sent++;
    }
  }

  logger.debug("Broadcast message", { type: message.type, clients: sent });
}

export function broadcastStats(data: unknown): void {
  broadcast({ type: "stats", data });
}

export function broadcastActivity(data: unknown): void {
  broadcast({ type: "activity", data });
}

export function broadcastLogs(data: unknown): void {
  broadcast({ type: "logs", data });
}

export function broadcastAccountUpdate(data: unknown): void {
  broadcast({ type: "account_update", data });
}

export function broadcastToast(data: { message: string; type: "info" | "success" | "warning" | "error" }): void {
  broadcast({ type: "toast", data });
}

export function getConnectedClientsCount(): number {
  return clients.size;
}

export function closeAllConnections(): void {
  for (const client of clients) {
    client.ws.close();
  }
  clients.clear();

  if (wss) {
    wss.close();
    wss = null;
  }

  logger.info("WebSocket server closed");
}
