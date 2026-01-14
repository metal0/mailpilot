export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(
  level: LogLevel,
  context: string,
  message: string,
  meta?: Record<string, unknown>
): string {
  const timestamp = formatTimestamp();
  const levelStr = level.toUpperCase().padEnd(5);
  const base = `${timestamp} [${levelStr}] [${context}] ${message}`;

  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(subContext: string): Logger;
}

export function createLogger(context: string): Logger {
  return {
    debug(message: string, meta?: Record<string, unknown>): void {
      if (shouldLog("debug")) {
        console.debug(formatMessage("debug", context, message, meta));
      }
    },
    info(message: string, meta?: Record<string, unknown>): void {
      if (shouldLog("info")) {
        console.info(formatMessage("info", context, message, meta));
      }
    },
    warn(message: string, meta?: Record<string, unknown>): void {
      if (shouldLog("warn")) {
        console.warn(formatMessage("warn", context, message, meta));
      }
    },
    error(message: string, meta?: Record<string, unknown>): void {
      if (shouldLog("error")) {
        console.error(formatMessage("error", context, message, meta));
      }
    },
    child(subContext: string): Logger {
      return createLogger(`${context}:${subContext}`);
    },
  };
}
