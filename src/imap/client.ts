import { ImapFlow, type ImapFlowOptions } from "imapflow";
import type * as tls from "node:tls";
import type { ImapConfig, TlsMode } from "../config/schema.js";
import { createLogger } from "../utils/logger.js";
import { retryIndefinitely } from "../utils/retry.js";
import { detectProvider, type ProviderInfo } from "./detection.js";
import { getAccessToken, buildXOAuth2Token, type OAuthCredentials } from "./oauth.js";

const logger = createLogger("imap-client");

export interface ImapClientOptions {
  config: ImapConfig;
  accountName: string;
}

export interface ImapClient {
  client: ImapFlow;
  providerInfo: ProviderInfo;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listFolders(): Promise<string[]>;
  getUnseenMessages(folder: string): Promise<MessageInfo[]>;
  moveMessage(uid: number, folder: string, targetFolder: string): Promise<void>;
  flagMessage(uid: number, folder: string, flags: string[]): Promise<void>;
  deleteMessage(uid: number, folder: string): Promise<void>;
  markAsRead(uid: number, folder: string): Promise<void>;
  markAsSpam(uid: number, folder: string): Promise<void>;
  createFolder(folderName: string): Promise<void>;
  getMessageFlags(uid: number, folder: string): Promise<string[]>;
  appendMessage(folder: string, source: Buffer, flags?: string[], date?: Date): Promise<number>;
  fetchMessageSource(uid: number, folder: string): Promise<Buffer>;
}

export interface MessageInfo {
  uid: number;
  messageId: string;
  from: string;
  subject: string;
  date: Date;
  size: number;
}

export function createImapClient(options: ImapClientOptions): ImapClient {
  const { config, accountName } = options;
  const log = logger.child(accountName);

  const detectedProvider = detectProvider(config.host, config.port);
  // Create mutable copy - supportsIdle will be updated after connection
  const providerInfo: ProviderInfo = { ...detectedProvider };

  let authConfig: { user: string; pass?: string; accessToken?: string };

  if (config.auth === "basic" && config.password) {
    authConfig = {
      user: config.username,
      pass: config.password,
    };
  } else {
    authConfig = {
      user: config.username,
    };
  }

  // Build TLS options based on configuration
  const tlsOptions: tls.ConnectionOptions = {};
  const trustedFingerprints = config.trusted_tls_fingerprints || [];

  if (trustedFingerprints.length > 0) {
    // When we have trusted fingerprints, allow self-signed certs but verify the fingerprint
    tlsOptions.rejectUnauthorized = false;
    tlsOptions.checkServerIdentity = (_hostname, cert) => {
      const fingerprint = cert.fingerprint256;
      const isTrusted = trustedFingerprints.some(fp =>
        fp.replace(/^sha256:/i, "").toUpperCase() === fingerprint.toUpperCase()
      );
      if (!isTrusted) {
        return new Error(`Certificate fingerprint ${fingerprint} not in trusted list`);
      }
      return undefined;
    };
  }

  // Determine if we should use secure connection
  // "insecure" mode means no TLS at all (plaintext), not bypassing certificate validation
  const useSecure = shouldUseSecure(config.tls);
  // Both direct TLS (secure=true) and STARTTLS (secure=false) use TLS options.
  // ImapFlow applies the tls options during STARTTLS upgrade when secure=false.
  const usesTls = config.tls !== "insecure";

  // Build IMAP options, conditionally including TLS options if present.
  // The tls options include checkServerIdentity for trusted fingerprint verification,
  // which applies to both direct TLS connections and STARTTLS upgrades.
  const imapOptions: ImapFlowOptions = {
    host: config.host,
    port: config.port,
    secure: useSecure,
    auth: authConfig,
    logger: false,
    ...(usesTls && Object.keys(tlsOptions).length > 0 ? { tls: tlsOptions } : {}),
  };

  const client = new ImapFlow(imapOptions);

  // Set up error handler to prevent uncaught exceptions from socket errors
  client.on("error", (error: Error) => {
    // Log the error but don't rethrow - let the connection retry handle it
    const isCertError = error.message.includes("self-signed") ||
      error.message.includes("certificate") ||
      error.message.includes("CERT_");

    if (isCertError) {
      log.error("IMAP TLS certificate error - check trusted_tls_fingerprints config", {
        error: error.message,
        hint: "If this is a self-signed certificate, add its fingerprint to trusted_tls_fingerprints in your account config",
      });
    } else {
      log.error("IMAP client error", {
        error: error.message,
        stack: error.stack,
      });
    }
  });

  // Handle connection close events
  client.on("close", () => {
    log.debug("IMAP connection closed");
  });

  return {
    client,
    providerInfo,

    async connect(): Promise<void> {
      log.info("Connecting to IMAP server", {
        host: config.host,
        port: config.port,
      });

      await retryIndefinitely(async () => {
        if (config.auth === "oauth2") {
          if (!config.oauth_client_id || !config.oauth_client_secret || !config.oauth_refresh_token) {
            throw new Error("OAuth2 auth requires oauth_client_id, oauth_client_secret, and oauth_refresh_token");
          }
          const provider = providerInfo.type === "gmail" ? "gmail" : "outlook";
          const credentials: OAuthCredentials = {
            clientId: config.oauth_client_id,
            clientSecret: config.oauth_client_secret,
            refreshToken: config.oauth_refresh_token,
          };

          const accessToken = await getAccessToken(provider, credentials);
          const xoauth2Token = buildXOAuth2Token(config.username, accessToken);

          (client as unknown as { options: { auth: typeof authConfig } }).options.auth = {
            user: config.username,
            accessToken: xoauth2Token,
          };
        }

        try {
          await client.connect();
        } catch (error) {
          // Check if this is a certificate error - these should not be retried
          // and should provide a helpful message instead of becoming uncaught exceptions
          if (error instanceof Error) {
            const isCertError = error.message.includes("self-signed") ||
              error.message.includes("DEPTH_ZERO_SELF_SIGNED_CERT") ||
              error.message.includes("SELF_SIGNED_CERT_IN_CHAIN") ||
              error.message.includes("UNABLE_TO_VERIFY_LEAF_SIGNATURE") ||
              error.message.includes("certificate");

            if (isCertError) {
              log.error("TLS certificate error - connection cannot proceed", {
                error: error.message,
                hint: "Add the certificate fingerprint to 'trusted_tls_fingerprints' in your account config. " +
                  "Use the dashboard to test the connection and trust the certificate first.",
              });
              // Wrap in a special error that won't be retried
              const certError = new Error(
                `Certificate error: ${error.message}. ` +
                `To fix this, use the dashboard to test the connection, trust the certificate, ` +
                `then update your account configuration with the trusted fingerprint.`
              );
              (certError as NodeJS.ErrnoException).code = "CERT_ERROR";
              throw certError;
            }
          }
          throw error;
        }
      });

      // Check actual IDLE capability from server
      const serverSupportsIdle = client.capabilities.has("IDLE");
      if (serverSupportsIdle !== providerInfo.supportsIdle) {
        log.info("IDLE capability differs from detection", {
          detected: providerInfo.supportsIdle,
          actual: serverSupportsIdle,
        });
        providerInfo.supportsIdle = serverSupportsIdle;
      }

      log.info("Connected to IMAP server", {
        provider: providerInfo.name,
        supportsIdle: providerInfo.supportsIdle,
      });
    },

    async disconnect(): Promise<void> {
      log.info("Disconnecting from IMAP server");
      await client.logout();
    },

    async listFolders(): Promise<string[]> {
      const folders: string[] = [];
      const list = await client.list();

      for (const folder of list) {
        if (!folder.flags.has("\\Noselect")) {
          folders.push(folder.path);
        }
      }

      log.debug("Listed folders", { count: folders.length });
      return folders;
    },

    async getUnseenMessages(folder: string): Promise<MessageInfo[]> {
      const messages: MessageInfo[] = [];
      const lock = await client.getMailboxLock(folder);

      try {
        const searchResult = await client.search({ seen: false });

        if (!searchResult || (Array.isArray(searchResult) && searchResult.length === 0)) {
          return messages;
        }

        for await (const msg of client.fetch(searchResult, {
          uid: true,
          envelope: true,
          size: true,
        })) {
          if (!msg.envelope) {
            continue;
          }

          const from =
            msg.envelope.from?.[0]?.address ?? msg.envelope.from?.[0]?.name ?? "unknown";
          const subject = msg.envelope.subject ?? "(no subject)";

          messages.push({
            uid: msg.uid,
            messageId: msg.envelope.messageId ?? `uid-${msg.uid}`,
            from,
            subject,
            date: msg.envelope.date ?? new Date(),
            size: msg.size ?? 0,
          });
        }
      } finally {
        lock.release();
      }

      log.debug("Found unseen messages", { folder, count: messages.length });
      return messages;
    },

    async moveMessage(
      uid: number,
      folder: string,
      targetFolder: string
    ): Promise<void> {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageMove([uid], targetFolder, { uid: true });
        log.debug("Moved message", { uid, from: folder, to: targetFolder });
      } finally {
        lock.release();
      }
    },

    async flagMessage(uid: number, folder: string, flags: string[]): Promise<void> {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageFlagsAdd([uid], flags, { uid: true });
        log.debug("Flagged message", { uid, flags });
      } finally {
        lock.release();
      }
    },

    async deleteMessage(uid: number, folder: string): Promise<void> {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageDelete([uid], { uid: true });
        log.debug("Deleted message", { uid });
      } finally {
        lock.release();
      }
    },

    async markAsRead(uid: number, folder: string): Promise<void> {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageFlagsAdd([uid], ["\\Seen"], { uid: true });
        log.debug("Marked message as read", { uid });
      } finally {
        lock.release();
      }
    },

    async markAsSpam(uid: number, folder: string): Promise<void> {
      const lock = await client.getMailboxLock(folder);
      try {
        const spamFolders = ["Spam", "Junk", "[Gmail]/Spam"];
        let moved = false;

        for (const spamFolder of spamFolders) {
          try {
            await client.messageMove([uid], spamFolder, { uid: true });
            moved = true;
            log.debug("Moved message to spam", { uid, folder: spamFolder });
            break;
          } catch {
            continue;
          }
        }

        if (!moved) {
          await client.messageFlagsAdd([uid], ["$Junk", "\\Flagged"], {
            uid: true,
          });
          log.debug("Flagged message as spam", { uid });
        }
      } finally {
        lock.release();
      }
    },

    async createFolder(folderName: string): Promise<void> {
      try {
        await client.mailboxCreate(folderName);
        log.info("Created folder", { folder: folderName });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("ALREADYEXISTS")
        ) {
          log.debug("Folder already exists", { folder: folderName });
        } else {
          throw error;
        }
      }
    },

    async getMessageFlags(uid: number, folder: string): Promise<string[]> {
      const lock = await client.getMailboxLock(folder);
      try {
        const msg = await client.fetchOne(uid, { flags: true }, { uid: true });
        if (!msg) {
          return [];
        }
        return msg.flags ? Array.from(msg.flags) : [];
      } finally {
        lock.release();
      }
    },

    async appendMessage(
      folder: string,
      source: Buffer,
      flags?: string[],
      date?: Date
    ): Promise<number> {
      const result = await client.append(folder, source, flags, date);
      if (!result || !result.uid) {
        throw new Error("Failed to append message - no UID returned");
      }
      log.debug("Appended message", { folder, uid: result.uid });
      return result.uid;
    },

    async fetchMessageSource(uid: number, folder: string): Promise<Buffer> {
      const lock = await client.getMailboxLock(folder);
      try {
        const msg = await client.fetchOne(uid, { source: true }, { uid: true });
        if (!msg || !msg.source) {
          throw new Error(`Failed to fetch message source for UID ${uid}`);
        }
        return msg.source;
      } finally {
        lock.release();
      }
    },
  };
}

/**
 * Determines if we should use a secure (TLS) connection from the start.
 *
 * TLS modes:
 * - "tls": Direct TLS connection on port (typically 993)
 * - "starttls": Plain connection, then upgrade to TLS after STARTTLS command
 * - "insecure": No TLS at all - plaintext connection only (NOT recommended)
 * - "auto": Default to TLS
 *
 * Note: "insecure" means NO encryption, not "bypass certificate validation".
 * For self-signed certificates, use trusted_tls_fingerprints config instead.
 */
function shouldUseSecure(tlsMode: TlsMode): boolean {
  switch (tlsMode) {
    case "tls":
      return true;
    case "starttls":
      // STARTTLS starts plain and upgrades - ImapFlow handles this automatically
      return false;
    case "insecure":
      // No TLS at all - plaintext only
      return false;
    case "auto":
    default:
      return true;
  }
}
