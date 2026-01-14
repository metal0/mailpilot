import { createLogger } from "../utils/logger.js";

const logger = createLogger("imap-detection");

export type ProviderType =
  | "gmail"
  | "outlook"
  | "protonmail"
  | "fastmail"
  | "generic";

export interface ProviderInfo {
  type: ProviderType;
  name: string;
  supportsIdle: boolean;
  requiresOAuth: boolean;
  notes?: string;
}

const PROVIDER_PATTERNS: Array<{
  pattern: RegExp;
  info: ProviderInfo;
}> = [
  {
    pattern: /imap\.gmail\.com/i,
    info: {
      type: "gmail",
      name: "Gmail",
      supportsIdle: true,
      requiresOAuth: false,
    },
  },
  {
    pattern: /outlook\.office365\.com/i,
    info: {
      type: "outlook",
      name: "Microsoft 365",
      supportsIdle: true,
      requiresOAuth: false,
    },
  },
  {
    pattern: /imap-mail\.outlook\.com/i,
    info: {
      type: "outlook",
      name: "Outlook.com",
      supportsIdle: true,
      requiresOAuth: false,
    },
  },
  {
    pattern: /127\.0\.0\.1|localhost/i,
    info: {
      type: "protonmail",
      name: "Proton Bridge (local)",
      supportsIdle: false,
      requiresOAuth: false,
      notes:
        "Proton Bridge detected. Ensure Bridge is running and configured correctly.",
    },
  },
  {
    pattern: /imap\.fastmail\.com/i,
    info: {
      type: "fastmail",
      name: "Fastmail",
      supportsIdle: true,
      requiresOAuth: false,
    },
  },
];

export function detectProvider(host: string, port?: number): ProviderInfo {
  for (const { pattern, info } of PROVIDER_PATTERNS) {
    if (pattern.test(host)) {
      if (info.type === "protonmail" && port !== 1143) {
        continue;
      }

      logger.debug("Provider detected", { host, provider: info.name });
      return info;
    }
  }

  logger.debug("Generic IMAP provider", { host });
  return {
    type: "generic",
    name: "Generic IMAP",
    supportsIdle: true,
    requiresOAuth: false,
  };
}

export function isProtonBridge(host: string, port: number): boolean {
  return (
    (host === "127.0.0.1" || host === "localhost") &&
    (port === 1143 || port === 1993)
  );
}

export function getProtonBridgeInstructions(): string {
  return `
Proton Bridge Setup Instructions:
1. Download and install Proton Bridge from https://proton.me/mail/bridge
2. Log in to your Proton account in Bridge
3. Enable IMAP in Bridge settings
4. Use the Bridge-generated password (not your Proton password)
5. Connect to localhost:1143 (STARTTLS) or localhost:1993 (TLS)

Note: Proton Bridge does not support IDLE, so polling will be used.
`;
}
