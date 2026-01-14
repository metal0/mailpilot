const DURATION_REGEX = /^(\d+)(ms|s|m|h|d|w|y)$/;

const MULTIPLIERS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000,
};

export function parseDuration(duration: string): number {
  const match = DURATION_REGEX.exec(duration);
  if (!match) {
    throw new Error(
      `Invalid duration format: ${duration}. Expected format: <number><unit> (e.g., 30s, 5m, 24h, 7d)`
    );
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  const multiplier = MULTIPLIERS[unit];

  if (multiplier === undefined) {
    throw new Error(`Unknown duration unit: ${unit}`);
  }

  return value * multiplier;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60 * 1000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 60 * 60 * 1000) return `${Math.floor(ms / (60 * 1000))}m`;
  if (ms < 24 * 60 * 60 * 1000) return `${Math.floor(ms / (60 * 60 * 1000))}h`;
  return `${Math.floor(ms / (24 * 60 * 60 * 1000))}d`;
}
