import { z } from "zod";

const durationRegex = /^(\d+)(ms|s|m|h|d|w|y)$/;
const durationSchema = z.string().refine((val) => durationRegex.test(val), {
  message:
    "Invalid duration format. Use format like: 30s, 5m, 24h, 7d, 2w, 1y",
});

const envVarPattern = /\$\{([^}]+)\}/g;

export function resolveEnvVars(value: string): string {
  return value.replace(envVarPattern, (_, varName: string) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new Error(`Environment variable ${varName} is not set`);
    }
    return envValue;
  });
}

const tlsModeSchema = z.enum(["auto", "tls", "starttls", "insecure"]);

const authTypeSchema = z.enum(["basic", "oauth2"]);

const imapConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive().default(993),
  tls: tlsModeSchema.default("auto"),
  auth: authTypeSchema.default("basic"),
  username: z.string().min(1),
  password: z.string().optional(),
  oauth_client_id: z.string().optional(),
  oauth_client_secret: z.string().optional(),
  oauth_refresh_token: z.string().optional(),
});

const webhookEventSchema = z.enum([
  "startup",
  "shutdown",
  "error",
  "action_taken",
  "connection_lost",
  "connection_restored",
]);

const webhookConfigSchema = z.object({
  url: z.string().url(),
  events: z.array(webhookEventSchema).min(1),
  headers: z.record(z.string(), z.string()).optional(),
});

const folderModeSchema = z.enum(["predefined", "auto_create"]);

const foldersConfigSchema = z.object({
  watch: z.array(z.string()).default(["INBOX"]),
  mode: folderModeSchema.default("predefined"),
  allowed: z.array(z.string()).optional(),
});

const llmSelectionSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
});

const accountConfigSchema = z.object({
  name: z.string().min(1),
  imap: imapConfigSchema,
  llm: llmSelectionSchema.optional(),
  webhooks: z.array(webhookConfigSchema).default([]),
  folders: foldersConfigSchema.optional(),
  prompt_override: z.string().optional(),
  prompt_file: z.string().optional(),
});

const llmProviderSchema = z.object({
  name: z.string().min(1),
  api_url: z.string().url(),
  api_key: z.string().optional(),
  default_model: z.string().min(1),
  max_body_tokens: z.number().int().positive().default(4000),
  max_thread_tokens: z.number().int().positive().default(2000),
  rate_limit_rpm: z.number().int().positive().optional(),
});

const backlogModeSchema = z.enum([
  "all",
  "recent_count",
  "recent_days",
  "new_only",
]);

const backlogConfigSchema = z.object({
  mode: backlogModeSchema.default("new_only"),
  count: z.number().int().positive().optional(),
  age: durationSchema.optional(),
});

const stateConfigSchema = z.object({
  database_path: z.string().default("./data/mailpilot.db"),
  processed_ttl: durationSchema.default("24h"),
  audit_retention: durationSchema.default("30d"),
  audit_subjects: z.boolean().default(false),
});

const loggingConfigSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  file: z.string().optional(),
  include_subjects: z.boolean().default(false),
});

const serverConfigSchema = z.object({
  port: z.number().int().positive().default(8080),
  auth_token: z.string().optional(),
});

const virusActionSchema = z.enum(["quarantine", "delete", "flag_only"]);

const antivirusConfigSchema = z.object({
  enabled: z.boolean().default(false),
  host: z.string().default("localhost"),
  port: z.number().int().positive().default(3310),
  timeout: durationSchema.default("30s"),
  on_virus_detected: virusActionSchema.default("quarantine"),
});

export const configSchema = z.object({
  polling_interval: durationSchema.default("30s"),
  concurrency_limit: z.number().int().positive().default(5),
  dry_run: z.boolean().default(false),
  backlog: backlogConfigSchema.optional(),
  state: stateConfigSchema.optional(),
  llm_providers: z.array(llmProviderSchema).min(1),
  default_prompt: z.string().optional(),
  default_prompt_file: z.string().optional(),
  logging: loggingConfigSchema.optional(),
  server: serverConfigSchema.optional(),
  antivirus: antivirusConfigSchema.optional(),
  accounts: z.array(accountConfigSchema).min(1),
});

export type Config = z.infer<typeof configSchema>;
export type AccountConfig = z.infer<typeof accountConfigSchema>;
export type LlmProviderConfig = z.infer<typeof llmProviderSchema>;
export type ImapConfig = z.infer<typeof imapConfigSchema>;
export type WebhookConfig = z.infer<typeof webhookConfigSchema>;
export type FoldersConfig = z.infer<typeof foldersConfigSchema>;
export type BacklogConfig = z.infer<typeof backlogConfigSchema>;
export type StateConfig = z.infer<typeof stateConfigSchema>;
export type LoggingConfig = z.infer<typeof loggingConfigSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type AntivirusConfig = z.infer<typeof antivirusConfigSchema>;

export type TlsMode = z.infer<typeof tlsModeSchema>;
export type AuthType = z.infer<typeof authTypeSchema>;
export type FolderMode = z.infer<typeof folderModeSchema>;
export type BacklogMode = z.infer<typeof backlogModeSchema>;
export type VirusAction = z.infer<typeof virusActionSchema>;
export type WebhookEvent = z.infer<typeof webhookEventSchema>;
