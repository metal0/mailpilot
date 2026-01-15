import { randomBytes } from "node:crypto";
import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  getSession,
  extendSession,
  getUserById,
  type DashboardUser,
} from "../storage/dashboard.js";
import { createLogger } from "../utils/logger.js";
import type { ApiKeyConfig, ApiKeyPermission } from "../config/schema.js";

const logger = createLogger("auth");

const SESSION_COOKIE = "mailpilot_session";
const CSRF_COOKIE = "mailpilot_csrf";

// Rate limiting: track failed login attempts by IP
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface AuthContext {
  user: DashboardUser;
  sessionId: string;
}

export function getAuthContext(c: Context): AuthContext | null {
  return c.get("auth") as AuthContext | null;
}

export function getCsrfToken(c: Context): string {
  return c.get("csrfToken") as string;
}

function getClientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    return first ? first.trim() : "unknown";
  }
  return c.req.header("x-real-ip") ?? "unknown";
}

export function checkRateLimit(c: Context): { allowed: boolean; retryAfter?: number } {
  const ip = getClientIp(c);
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record) {
    return { allowed: true };
  }

  // Clean up old records
  if (now - record.lastAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const timeSinceLast = now - record.lastAttempt;
    if (timeSinceLast < LOCKOUT_DURATION_MS) {
      const retryAfter = Math.ceil((LOCKOUT_DURATION_MS - timeSinceLast) / 1000);
      return { allowed: false, retryAfter };
    }
    // Lockout expired, reset
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedLogin(c: Context): void {
  const ip = getClientIp(c);
  const now = Date.now();
  const existing = loginAttempts.get(ip);

  let attempts: number;
  if (existing) {
    existing.count++;
    existing.lastAttempt = now;
    attempts = existing.count;
  } else {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    attempts = 1;
  }

  logger.warn("Failed login attempt", { ip, attempts, maxAttempts: MAX_ATTEMPTS });
}

export function clearFailedLogins(c: Context): void {
  const ip = getClientIp(c);
  loginAttempts.delete(ip);
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function createSessionMiddleware(sessionTtl: string) {
  return async (c: Context, next: Next) => {
    const sessionId = getCookie(c, SESSION_COOKIE);

    if (sessionId) {
      const session = getSession(sessionId);
      if (session) {
        const user = getUserById(session.userId);
        if (user) {
          c.set("auth", { user, sessionId } as AuthContext);
          extendSession(sessionId, sessionTtl);
        }
      }
    }

    // Generate or retrieve CSRF token
    let csrfToken = getCookie(c, CSRF_COOKIE);
    if (!csrfToken) {
      csrfToken = generateCsrfToken();
      setCookie(c, CSRF_COOKIE, csrfToken, {
        httpOnly: true,
        secure: false,
        sameSite: "Strict",
        path: "/",
        maxAge: 60 * 60 * 24,
      });
    }
    c.set("csrfToken", csrfToken);

    await next();
  };
}

export function validateCsrf(c: Context, formToken: string | undefined): boolean {
  const cookieToken = getCookie(c, CSRF_COOKIE);
  if (!cookieToken || !formToken) {
    return false;
  }
  return cookieToken === formToken;
}

export function setSessionCookie(c: Context, sessionId: string): void {
  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, {
    path: "/",
  });
}

export function requireAuth(c: Context): AuthContext | Response {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.redirect("/login");
  }
  return auth;
}

// Cleanup old rate limit records periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts) {
    if (now - record.lastAttempt > RATE_LIMIT_WINDOW_MS) {
      loginAttempts.delete(ip);
    }
  }
}, 60 * 1000);

// API Key authentication
let configuredApiKeys: ApiKeyConfig[] = [];

export function setApiKeys(keys: ApiKeyConfig[]): void {
  configuredApiKeys = keys;
}

export interface ApiKeyContext {
  apiKey: ApiKeyConfig;
}

export function getApiKeyContext(c: Context): ApiKeyContext | null {
  return c.get("apiKey") as ApiKeyContext | null;
}

function hasPermission(apiKey: ApiKeyConfig, required: ApiKeyPermission): boolean {
  if (apiKey.permissions.includes("*")) {
    return true;
  }

  if (apiKey.permissions.includes(required)) {
    return true;
  }

  // Check wildcard permissions
  if (required.startsWith("read:") && apiKey.permissions.includes("read:*")) {
    return true;
  }
  if (required.startsWith("write:") && apiKey.permissions.includes("write:*")) {
    return true;
  }

  // Write implies read (e.g., write:stats implies read:stats)
  if (required.startsWith("read:")) {
    const resource = required.slice(5); // Remove "read:" prefix
    if (apiKey.permissions.includes(`write:${resource}` as ApiKeyPermission)) {
      return true;
    }
    // write:* also implies all read permissions
    if (apiKey.permissions.includes("write:*")) {
      return true;
    }
  }

  return false;
}

export function validateApiKey(c: Context): ApiKeyConfig | null {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  const apiKey = configuredApiKeys.find((k) => k.key === token);

  if (apiKey) {
    c.set("apiKey", { apiKey } as ApiKeyContext);
  }

  return apiKey ?? null;
}

export function requireApiPermission(permission: ApiKeyPermission) {
  return (c: Context): boolean => {
    const apiKeyCtx = getApiKeyContext(c);
    if (!apiKeyCtx) {
      return false;
    }
    return hasPermission(apiKeyCtx.apiKey, permission);
  };
}

export function requireAuthOrApiKey(requiredPermission?: ApiKeyPermission) {
  return async (c: Context, next: Next) => {
    // First check session auth
    const auth = getAuthContext(c);
    if (auth) {
      await next();
      return;
    }

    // Then check API key
    const apiKey = validateApiKey(c);
    if (apiKey) {
      if (requiredPermission && !hasPermission(apiKey, requiredPermission)) {
        return c.json({ error: "Insufficient permissions" }, 403);
      }
      await next();
      return;
    }

    return c.json({ error: "Unauthorized" }, 401);
  };
}
