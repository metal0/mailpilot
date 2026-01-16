import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { getDatabase } from "./database.js";
import { parseDuration } from "../utils/duration.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("dashboard");

const BCRYPT_ROUNDS = 12;

export interface DashboardUser {
  id: number;
  username: string;
  createdAt: number;
}

export interface DashboardSession {
  id: string;
  userId: number;
  createdAt: number;
  expiresAt: number;
}

export function getUserCount(): number {
  const db = getDatabase();
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM dashboard_users`);
  const result = stmt.get() as { count: number };
  return result.count;
}

export function getUserByUsername(username: string): DashboardUser | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, username, created_at
    FROM dashboard_users
    WHERE username = ?
  `);
  const row = stmt.get(username) as {
    id: number;
    username: string;
    created_at: number;
  } | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
  };
}

export function getUserById(id: number): DashboardUser | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, username, created_at
    FROM dashboard_users
    WHERE id = ?
  `);
  const row = stmt.get(id) as {
    id: number;
    username: string;
    created_at: number;
  } | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
  };
}

export async function createUser(
  username: string,
  password: string
): Promise<DashboardUser> {
  const db = getDatabase();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const stmt = db.prepare(`
    INSERT INTO dashboard_users (username, password_hash, created_at)
    VALUES (?, ?, ?)
  `);

  const now = Date.now();
  const result = stmt.run(username, passwordHash, now);

  logger.debug("Dashboard user created", { username });

  return {
    id: Number(result.lastInsertRowid),
    username,
    createdAt: now,
  };
}

export async function verifyPassword(
  username: string,
  password: string
): Promise<DashboardUser | null> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, username, password_hash, created_at
    FROM dashboard_users
    WHERE username = ?
  `);
  const row = stmt.get(username) as {
    id: number;
    username: string;
    password_hash: string;
    created_at: number;
  } | undefined;

  if (!row) {
    return null;
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
  };
}

export function createSession(userId: number, ttl: string): DashboardSession {
  const db = getDatabase();
  const sessionId = randomUUID();
  const now = Date.now();
  const ttlMs = parseDuration(ttl);
  const expiresAt = now + ttlMs;

  const stmt = db.prepare(`
    INSERT INTO dashboard_sessions (id, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(sessionId, userId, now, expiresAt);

  logger.debug("Session created", { userId, expiresAt: new Date(expiresAt).toISOString() });

  return {
    id: sessionId,
    userId,
    createdAt: now,
    expiresAt,
  };
}

export function getSession(sessionId: string): DashboardSession | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, user_id, created_at, expires_at
    FROM dashboard_sessions
    WHERE id = ? AND expires_at > ?
  `);
  const row = stmt.get(sessionId, Date.now()) as {
    id: string;
    user_id: number;
    created_at: number;
    expires_at: number;
  } | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export function extendSession(sessionId: string, ttl: string): boolean {
  const db = getDatabase();
  const ttlMs = parseDuration(ttl);
  const newExpiresAt = Date.now() + ttlMs;

  const stmt = db.prepare(`
    UPDATE dashboard_sessions
    SET expires_at = ?
    WHERE id = ? AND expires_at > ?
  `);
  const result = stmt.run(newExpiresAt, sessionId, Date.now());

  return result.changes > 0;
}

export function deleteSession(sessionId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`DELETE FROM dashboard_sessions WHERE id = ?`);
  const result = stmt.run(sessionId);
  return result.changes > 0;
}

export function deleteUserSessions(userId: number): number {
  const db = getDatabase();
  const stmt = db.prepare(`DELETE FROM dashboard_sessions WHERE user_id = ?`);
  const result = stmt.run(userId);
  return result.changes;
}

export function cleanupExpiredSessions(): number {
  const db = getDatabase();
  const stmt = db.prepare(`DELETE FROM dashboard_sessions WHERE expires_at < ?`);
  const result = stmt.run(Date.now());

  if (result.changes > 0) {
    logger.debug("Cleaned up expired sessions", { deleted: result.changes });
  }

  return result.changes;
}
