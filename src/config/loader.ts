import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { parse, stringify } from "yaml";
import { dirname } from "node:path";
import { type Config, configSchema, resolveEnvVars } from "./schema.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("config");

const ENV_VAR_PATTERN = /\$\{([^}]+)\}/;

function resolveEnvVarsInObject(obj: unknown): unknown {
  if (typeof obj === "string") {
    if (ENV_VAR_PATTERN.test(obj)) {
      return resolveEnvVars(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveEnvVarsInObject(item));
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvVarsInObject(value);
    }
    return result;
  }

  return obj;
}

const MINIMAL_CONFIG = {
  dry_run: true,
  logging: { level: "debug" },
  server: { port: 8085 },
  dashboard: { enabled: true },
  llm_providers: [],
  accounts: [],
};

export function loadConfig(configPath = "./config.yaml"): Config {
  if (!existsSync(configPath)) {
    logger.info("Config file not found, creating minimal config", { path: configPath });
    const dir = dirname(configPath);
    if (dir && dir !== "." && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const yaml = stringify(MINIMAL_CONFIG);
    writeFileSync(configPath, yaml, "utf-8");
    logger.info("Minimal config created - configure via dashboard", { path: configPath });
  }

  logger.info("Loading configuration", { path: configPath });

  const rawYaml = readFileSync(configPath, "utf-8");
  const parsed: unknown = parse(rawYaml);

  const resolved = resolveEnvVarsInObject(parsed);

  const result = configSchema.safeParse(resolved);

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${errors}`);
  }

  validateConfig(result.data);

  logger.info("Configuration loaded successfully", {
    accounts: result.data.accounts.length,
    providers: result.data.llm_providers.length,
  });

  return result.data;
}

function validateConfig(config: Config): void {
  const providerNames = new Set(config.llm_providers.map((p) => p.name));

  // Allow empty accounts/providers for initial setup via dashboard
  if (config.accounts.length === 0 && config.llm_providers.length === 0) {
    logger.info("No accounts or providers configured - use dashboard to add them");
    return;
  }

  // If we have accounts but no providers, warn but don't fail
  if (config.accounts.length > 0 && config.llm_providers.length === 0) {
    logger.warn("Accounts configured but no LLM providers - emails will not be processed");
  }

  for (const account of config.accounts) {
    if (account.llm?.provider && !providerNames.has(account.llm.provider)) {
      throw new Error(
        `Account "${account.name}" references unknown LLM provider "${account.llm.provider}"`
      );
    }

    if (account.imap.auth === "basic" && !account.imap.password) {
      throw new Error(
        `Account "${account.name}" uses basic auth but no password is provided`
      );
    }

    if (account.imap.auth === "oauth2") {
      if (!account.imap.oauth_client_id) {
        throw new Error(
          `Account "${account.name}" uses OAuth2 but no client_id is provided`
        );
      }
      if (!account.imap.oauth_client_secret) {
        throw new Error(
          `Account "${account.name}" uses OAuth2 but no client_secret is provided`
        );
      }
      if (!account.imap.oauth_refresh_token) {
        throw new Error(
          `Account "${account.name}" uses OAuth2 but no refresh_token is provided`
        );
      }
    }

    if (account.prompt_file && account.prompt_override) {
      throw new Error(
        `Account "${account.name}" has both prompt_override and prompt_file - use only one`
      );
    }

    if (account.prompt_file && !existsSync(account.prompt_file)) {
      throw new Error(
        `Account "${account.name}" prompt file not found: ${account.prompt_file}`
      );
    }
  }

  if (config.default_prompt && config.default_prompt_file) {
    throw new Error(
      "Both default_prompt and default_prompt_file specified - use only one"
    );
  }

  if (config.default_prompt_file && !existsSync(config.default_prompt_file)) {
    throw new Error(
      `Default prompt file not found: ${config.default_prompt_file}`
    );
  }

  if (config.backlog) {
    if (
      config.backlog.mode === "recent_count" &&
      config.backlog.count === undefined
    ) {
      throw new Error("Backlog mode 'recent_count' requires 'count' field");
    }

    if (
      config.backlog.mode === "recent_days" &&
      config.backlog.age === undefined
    ) {
      throw new Error("Backlog mode 'recent_days' requires 'age' field");
    }
  }
}

export function loadPrompt(config: Config, accountName?: string): string {
  if (accountName) {
    const account = config.accounts.find((a) => a.name === accountName);
    if (account?.prompt_override) {
      return account.prompt_override;
    }
    if (account?.prompt_file) {
      return readFileSync(account.prompt_file, "utf-8");
    }
  }

  if (config.default_prompt) {
    return config.default_prompt;
  }

  if (config.default_prompt_file) {
    return readFileSync(config.default_prompt_file, "utf-8");
  }

  return DEFAULT_PROMPT;
}

const DEFAULT_PROMPT = `You are an email classifier. Analyze the email and decide what action to take.

## Available Actions

- move: Move email to a specific folder
- spam: Mark as spam
- flag: Apply IMAP flags
- read: Mark as read
- delete: Delete the email
- noop: No action (leave in current folder)

## Response Format

Respond with a JSON object containing an array of actions:

{
  "actions": [
    {
      "type": "move",
      "folder": "Work",
      "reason": "Email from work domain"
    }
  ]
}

## Guidelines

- Use noop if unsure
- Never delete emails unless they are obvious spam
- Provide a reason for each action for audit purposes
`;
