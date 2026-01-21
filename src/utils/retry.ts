import { createLogger } from "./logger.js";

const logger = createLogger("retry");

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryIf?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: unknown
  ) {
    super(message);
    this.name = "RetryError";
  }
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const networkCodes = [
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
      "EAI_AGAIN",
    ];
    return networkCodes.some(
      (code) =>
        "code" in error && (error as NodeJS.ErrnoException).code === code
    );
  }
  return false;
}

function isCertificateError(error: unknown): boolean {
  if (error instanceof Error) {
    const certIndicators = [
      "self-signed",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
      "SELF_SIGNED_CERT_IN_CHAIN",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "CERT_ERROR",
      "certificate",
    ];
    return certIndicators.some(
      (indicator) => error.message.includes(indicator) ||
        ("code" in error && (error as NodeJS.ErrnoException).code === indicator)
    );
  }
  return false;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  let delay = opts.baseDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (opts.retryIf && !opts.retryIf(error)) {
        throw error;
      }

      if (attempt === opts.maxAttempts) {
        break;
      }

      logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
        error: error instanceof Error ? error.message : String(error),
      });

      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw new RetryError(
    `Failed after ${opts.maxAttempts} attempts`,
    opts.maxAttempts,
    lastError
  );
}

export class CertificateError extends Error {
  constructor(message: string, public readonly originalError: Error) {
    super(message);
    this.name = "CertificateError";
  }
}

export async function retryIndefinitely<T>(
  fn: () => Promise<T>,
  options: Partial<Omit<RetryOptions, "maxAttempts">> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let delay = opts.baseDelayMs;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    try {
      return await fn();
    } catch (error) {
      // Certificate errors should not be retried - they require user action
      if (isCertificateError(error)) {
        const certError = new CertificateError(
          error instanceof Error
            ? `Certificate error: ${error.message}. Configure trusted_tls_fingerprints in your account to trust this certificate.`
            : "Certificate validation failed",
          error instanceof Error ? error : new Error(String(error))
        );
        throw certError;
      }

      if (!isNetworkError(error)) {
        throw error;
      }

      logger.warn(`Network error, retrying in ${delay}ms`, {
        error: error instanceof Error ? error.message : String(error),
      });

      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
