export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

// Log buffer for dashboard log viewer
const LOG_BUFFER_SIZE = 500;

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  meta?: Record<string, unknown>;
}

const logBuffer: LogEntry[] = [];

// Optional WebSocket broadcast function (set by server during startup)
let broadcastLogsFn: ((data: unknown) => void) | null = null;

export function setLogsBroadcast(fn: (data: unknown) => void): void {
  broadcastLogsFn = fn;
}

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

function addToBuffer(
  level: LogLevel,
  context: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level,
    context,
    message,
  };

  if (meta !== undefined) {
    entry.meta = meta;
  }

  logBuffer.push(entry);

  // Keep buffer at max size
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }

  // Broadcast to WebSocket clients (only for info, warn, error - skip debug for performance)
  if (broadcastLogsFn && level !== "debug") {
    broadcastLogsFn(entry);
  }
}

export function getRecentLogs(
  limit = 100,
  levelFilter?: LogLevel
): LogEntry[] {
  let logs = logBuffer;

  if (levelFilter) {
    const minLevel = LOG_LEVELS[levelFilter];
    logs = logs.filter((entry) => LOG_LEVELS[entry.level] >= minLevel);
  }

  return logs.slice(-limit);
}

export function clearLogBuffer(): void {
  logBuffer.length = 0;
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
      addToBuffer("debug", context, message, meta);
      if (shouldLog("debug")) {
        console.debug(formatMessage("debug", context, message, meta));
      }
    },
    info(message: string, meta?: Record<string, unknown>): void {
      addToBuffer("info", context, message, meta);
      if (shouldLog("info")) {
        console.info(formatMessage("info", context, message, meta));
      }
    },
    warn(message: string, meta?: Record<string, unknown>): void {
      addToBuffer("warn", context, message, meta);
      if (shouldLog("warn")) {
        console.warn(formatMessage("warn", context, message, meta));
      }
    },
    error(message: string, meta?: Record<string, unknown>): void {
      addToBuffer("error", context, message, meta);
      if (shouldLog("error")) {
        console.error(formatMessage("error", context, message, meta));
      }
    },
    child(subContext: string): Logger {
      return createLogger(`${context}:${subContext}`);
    },
  };
}
