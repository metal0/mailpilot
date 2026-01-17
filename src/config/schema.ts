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
  url: z.url(),
  events: z.array(webhookEventSchema).min(1),
  headers: z.record(z.string(), z.string()).optional(),
});

const folderModeSchema = z.enum(["predefined", "auto_create"]);

const foldersConfigSchema = z.object({
  watch: z.array(z.string()).default(["INBOX"]),
  mode: folderModeSchema.default("predefined"),
  allowed: z.array(z.string()).optional(),
});

// Action types that can be allowed/disallowed per account
export const actionTypeSchema = z.enum(["move", "spam", "flag", "read", "delete", "noop"]);
export const ALL_ACTION_TYPES = ["move", "spam", "flag", "read", "delete", "noop"] as const;
// Default allowed actions (excludes delete for safety)
export const DEFAULT_ALLOWED_ACTIONS = ["move", "spam", "flag", "read", "noop"] as const;
export type ActionType = z.infer<typeof actionTypeSchema>;

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
  // Allowed action types for this account. If not specified, all actions are allowed.
  // Actions not in this list will be blocked even if the LLM returns them.
  allowed_actions: z.array(actionTypeSchema).optional(),
  // Per-account minimum confidence threshold. Overrides global confidence.minimum_threshold.
  minimum_confidence: z.number().min(0).max(1).optional(),
});

const llmProviderSchema = z.object({
  name: z.string().min(1),
  api_url: z.url(),
  api_key: z.string().optional(),
  default_model: z.string().min(1),
  max_body_tokens: z.number().int().positive().default(4000),
  max_thread_tokens: z.number().int().positive().default(2000),
  rate_limit_rpm: z.number().int().positive().optional(),
  supports_vision: z.boolean().default(false),
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

const apiKeyPermissionSchema = z.enum([
  "read:stats",
  "read:activity",
  "read:logs",
  "read:export",
  "read:accounts",
  "read:*",
  "write:stats",
  "write:activity",
  "write:logs",
  "write:export",
  "write:accounts",
  "write:*",
  "*",
]);

const apiKeyConfigSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(16),
  permissions: z.array(apiKeyPermissionSchema).default(["read:stats"]),
});

const dashboardConfigSchema = z.object({
  enabled: z.boolean().default(true),
  session_secret: z.string().optional(),
  session_ttl: durationSchema.default("24h"),
  api_keys: z.array(apiKeyConfigSchema).default([]),
});

const virusActionSchema = z.enum(["quarantine", "delete", "flag_only"]);

const antivirusConfigSchema = z.object({
  enabled: z.boolean().default(false),
  host: z.string().default("localhost"),
  port: z.number().int().positive().default(3310),
  timeout: durationSchema.default("30s"),
  on_virus_detected: virusActionSchema.default("quarantine"),
});

const attachmentsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  tika_url: z.url().optional(),
  timeout: durationSchema.default("30s"),
  max_size_mb: z.number().positive().default(10),
  max_extracted_chars: z.number().int().positive().default(10000),
  allowed_types: z.array(z.string()).default([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
    "text/html",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
  ]),
  extract_images: z.boolean().default(false),
});

const retryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  max_attempts: z.number().int().min(1).max(10).default(5),
  initial_delay: durationSchema.default("5m"),
  max_delay: durationSchema.default("24h"),
  backoff_multiplier: z.number().positive().default(2),
});

const notificationEventSchema = z.enum([
  "error",
  "connection_lost",
  "dead_letter",
  "retry_exhausted",
  "daily_summary",
]);

const notificationChannelSchema = z.literal("browser");

const notificationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  channels: z.array(notificationChannelSchema).default(["browser"]),
  events: z.array(notificationEventSchema).default(["error", "connection_lost"]),
  daily_summary_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quiet_hours: z.object({
    enabled: z.boolean().default(false),
    start: z.string().regex(/^\d{2}:\d{2}$/).default("22:00"),
    end: z.string().regex(/^\d{2}:\d{2}$/).default("08:00"),
  }).optional(),
});

const confidenceConfigSchema = z.object({
  enabled: z.boolean().default(false),
  minimum_threshold: z.number().min(0).max(1).default(0.7),
  request_reasoning: z.boolean().default(true),
});

const shutdownConfigSchema = z.object({
  timeout: durationSchema.default("30s"),
  wait_for_inflight: z.boolean().default(true),
  force_after: durationSchema.default("25s"),
});

export const configSchema = z.object({
  polling_interval: durationSchema.default("30s"),
  concurrency_limit: z.number().int().positive().default(5),
  dry_run: z.boolean().default(false),
  add_processing_headers: z.boolean().default(false),
  backlog: backlogConfigSchema.optional(),
  state: stateConfigSchema.optional(),
  llm_providers: z.array(llmProviderSchema).default([]),
  default_prompt: z.string().optional(),
  default_prompt_file: z.string().optional(),
  logging: loggingConfigSchema.optional(),
  server: serverConfigSchema.optional(),
  dashboard: dashboardConfigSchema.optional(),
  antivirus: antivirusConfigSchema.optional(),
  attachments: attachmentsConfigSchema.optional(),
  retry: retryConfigSchema.optional(),
  notifications: notificationConfigSchema.optional(),
  confidence: confidenceConfigSchema.optional(),
  shutdown: shutdownConfigSchema.optional(),
  accounts: z.array(accountConfigSchema).default([]),
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
export type DashboardConfig = z.infer<typeof dashboardConfigSchema>;
export type ApiKeyConfig = z.infer<typeof apiKeyConfigSchema>;
export type ApiKeyPermission = z.infer<typeof apiKeyPermissionSchema>;
export type AntivirusConfig = z.infer<typeof antivirusConfigSchema>;
export type AttachmentsConfig = z.infer<typeof attachmentsConfigSchema>;
export type RetryConfig = z.infer<typeof retryConfigSchema>;
export type NotificationConfig = z.infer<typeof notificationConfigSchema>;
export type NotificationEvent = z.infer<typeof notificationEventSchema>;
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type ConfidenceConfig = z.infer<typeof confidenceConfigSchema>;
export type ShutdownConfig = z.infer<typeof shutdownConfigSchema>;

export type TlsMode = z.infer<typeof tlsModeSchema>;
export type AuthType = z.infer<typeof authTypeSchema>;
export type FolderMode = z.infer<typeof folderModeSchema>;
export type BacklogMode = z.infer<typeof backlogModeSchema>;
export type VirusAction = z.infer<typeof virusActionSchema>;
export type WebhookEvent = z.infer<typeof webhookEventSchema>;
