import { Hono } from "hono";
import { getAccountStatuses, getUptime } from "./status.js";
import { getDeadLetterCount } from "../storage/dead-letter.js";
import { getAuditEntries } from "../storage/audit.js";

export const healthRouter = new Hono();

healthRouter.get("/health", (c) => {
  const accounts = getAccountStatuses();
  const connectedCount = accounts.filter((a) => a.connected).length;
  const totalAccounts = accounts.length;

  // Get last processed timestamp from audit log
  const recentActivity = getAuditEntries(undefined, 1);
  const firstEntry = recentActivity[0];
  const lastProcessed = firstEntry
    ? new Date(firstEntry.createdAt).toISOString()
    : null;

  return c.json({
    status: "ok",
    uptime: getUptime(),
    accounts: {
      connected: connectedCount,
      total: totalAccounts,
    },
    deadLetterCount: getDeadLetterCount(),
    lastProcessed,
  }, 200);
});
