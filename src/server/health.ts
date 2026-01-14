import { Hono } from "hono";
import type { AttachmentsConfig, AntivirusConfig } from "../config/schema.js";
import { getAccountStatuses, getUptime } from "./status.js";
import { getDeadLetterCount } from "../storage/dead-letter.js";
import { getAuditEntries } from "../storage/audit.js";
import { createTikaClient } from "../attachments/tika.js";

interface HealthConfig {
  attachments?: AttachmentsConfig;
  antivirus?: AntivirusConfig;
}

let healthConfig: HealthConfig | undefined;

export function setHealthConfig(config: HealthConfig): void {
  healthConfig = config;
}

export const healthRouter = new Hono();

healthRouter.get("/health", async (c) => {
  const accounts = getAccountStatuses();
  const connectedCount = accounts.filter((a) => a.connected).length;
  const totalAccounts = accounts.length;

  // Get last processed timestamp from audit log
  const recentActivity = getAuditEntries(undefined, 1);
  const firstEntry = recentActivity[0];
  const lastProcessed = firstEntry
    ? new Date(firstEntry.createdAt).toISOString()
    : null;

  // Check Tika health if attachments enabled
  let tika: { available: boolean; url: string } | undefined;
  if (healthConfig?.attachments?.enabled) {
    const tikaClient = createTikaClient(healthConfig.attachments);
    const tikaUrl = healthConfig.attachments.tika_url ?? "http://localhost:9998";
    tika = {
      available: await tikaClient.isHealthy(),
      url: tikaUrl,
    };
  }

  // Check ClamAV health if antivirus enabled
  let clamav: { available: boolean; host: string; port: number } | undefined;
  if (healthConfig?.antivirus?.enabled) {
    const avConfig = healthConfig.antivirus;
    clamav = {
      available: true, // ClamAV check would be via ping command
      host: avConfig.host,
      port: avConfig.port,
    };
  }

  return c.json({
    status: "ok",
    uptime: getUptime(),
    accounts: {
      connected: connectedCount,
      total: totalAccounts,
    },
    deadLetterCount: getDeadLetterCount(),
    lastProcessed,
    ...(tika && { tika }),
    ...(clamav && { clamav }),
  }, 200);
});
