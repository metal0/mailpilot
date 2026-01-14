import { Hono } from "hono";
import type { AccountConfig, ServerConfig } from "../config/schema.js";
import { getProcessedCount } from "../storage/processed.js";
import { getActionCount } from "../storage/audit.js";
import { getProviderStats } from "../llm/providers.js";

export interface AccountStatus {
  name: string;
  llmProvider: string;
  llmModel: string;
  connected: boolean;
  idleSupported: boolean;
  lastScan: string | null;
  emailsProcessed: number;
  actionsTaken: number;
  errors: number;
}

const accountStatuses = new Map<
  string,
  {
    connected: boolean;
    idleSupported: boolean;
    lastScan: Date | null;
    errors: number;
    llmProvider: string;
    llmModel: string;
  }
>();

const startTime = Date.now();

export function updateAccountStatus(
  accountName: string,
  status: Partial<{
    connected: boolean;
    idleSupported: boolean;
    lastScan: Date;
    errors: number;
    llmProvider: string;
    llmModel: string;
  }>
): void {
  const current = accountStatuses.get(accountName) ?? {
    connected: false,
    idleSupported: false,
    lastScan: null,
    errors: 0,
    llmProvider: "unknown",
    llmModel: "unknown",
  };

  accountStatuses.set(accountName, { ...current, ...status });
}

export function incrementAccountErrors(accountName: string): void {
  const current = accountStatuses.get(accountName);
  if (current) {
    current.errors++;
  }
}

export function getUptime(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

export function getAccountStatuses(): AccountStatus[] {
  const accounts: AccountStatus[] = [];

  for (const [name, status] of accountStatuses) {
    accounts.push({
      name,
      llmProvider: status.llmProvider,
      llmModel: status.llmModel,
      connected: status.connected,
      idleSupported: status.idleSupported,
      lastScan: status.lastScan?.toISOString() ?? null,
      emailsProcessed: getProcessedCount(name),
      actionsTaken: getActionCount(name),
      errors: status.errors,
    });
  }

  return accounts;
}

export function createStatusRouter(serverConfig: ServerConfig): Hono {
  const router = new Hono();

  router.get("/status", (c) => {
    if (serverConfig.auth_token) {
      const authHeader = c.req.header("Authorization");
      const token = authHeader?.replace("Bearer ", "");

      if (token !== serverConfig.auth_token) {
        return c.json({ error: "Unauthorized" }, 401);
      }
    }

    const accounts = getAccountStatuses();
    const totals = {
      emailsProcessed: getProcessedCount(),
      actionsTaken: getActionCount(),
      errors: accounts.reduce((sum, a) => sum + a.errors, 0),
    };

    return c.json({
      status: "running",
      uptime_seconds: getUptime(),
      accounts,
      totals,
      llm_providers: getProviderStats(),
    });
  });

  return router;
}

export function initializeAccountStatuses(accounts: AccountConfig[]): void {
  for (const account of accounts) {
    accountStatuses.set(account.name, {
      connected: false,
      idleSupported: false,
      lastScan: null,
      errors: 0,
      llmProvider: account.llm?.provider ?? "default",
      llmModel: account.llm?.model ?? "default",
    });
  }
}
