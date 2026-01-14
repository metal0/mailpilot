import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  getSession,
  extendSession,
  getUserById,
  type DashboardUser,
} from "../storage/dashboard.js";

const SESSION_COOKIE = "mailpilot_session";

export interface AuthContext {
  user: DashboardUser;
  sessionId: string;
}

export function getAuthContext(c: Context): AuthContext | null {
  return c.get("auth") as AuthContext | null;
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

    await next();
  };
}

export function setSessionCookie(c: Context, sessionId: string): void {
  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    path: "/dashboard",
    maxAge: 60 * 60 * 24,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, {
    path: "/dashboard",
  });
}

export function requireAuth(c: Context): AuthContext | Response {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.redirect("/dashboard/login");
  }
  return auth;
}
