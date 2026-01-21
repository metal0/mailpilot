import * as net from "node:net";
import * as tls from "node:tls";

export interface PortProbeResult {
  port: number;
  tls: "tls" | "starttls" | "none";
  success: boolean;
  capabilities?: string[];
  authMethods?: ("basic" | "oauth2")[];
}

export interface CertificateInfo {
  fingerprint256: string;
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  selfSigned: boolean;
}

export interface TlsProbeResult {
  success: boolean;
  certificateInfo?: CertificateInfo;
  error?: string;
  errorCode?: string;
}

export function probeTlsCertificate(
  host: string,
  port: number,
  timeoutMs = 5000
): Promise<TlsProbeResult> {
  return new Promise((resolve) => {
    let resolved = false;
    let socket: tls.TLSSocket | undefined;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { socket?.destroy(); } catch { /* ignore */ }
        resolve({ success: false, error: "Connection timed out", errorCode: "TIMEOUT" });
      }
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        try { socket?.destroy(); } catch { /* ignore */ }
      }
    };

    try {
      // First try with certificate validation to see if it passes
      socket = tls.connect({ host, port, rejectUnauthorized: true }, () => {
        // Connection succeeded with valid certificate
        const cert = socket?.getPeerCertificate();
        cleanup();
        if (cert && cert.fingerprint256) {
          const subjectObj = cert.subject as { CN?: string; O?: string } | undefined;
          const issuerObj = cert.issuer as { CN?: string; O?: string } | undefined;
          resolve({
            success: true,
            certificateInfo: {
              fingerprint256: cert.fingerprint256,
              subject: typeof cert.subject === "string" ? cert.subject :
                (subjectObj?.CN ?? subjectObj?.O ?? "Unknown"),
              issuer: typeof cert.issuer === "string" ? cert.issuer :
                (issuerObj?.CN ?? issuerObj?.O ?? "Unknown"),
              validFrom: cert.valid_from,
              validTo: cert.valid_to,
              selfSigned: false,
            },
          });
        } else {
          resolve({ success: true });
        }
      });

      // CRITICAL: Attach error handler immediately to prevent uncaught exceptions
      socket.on("error", (error: NodeJS.ErrnoException) => {
        // Try again without validation to get certificate info for self-signed certs
        if (error.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
            error.code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
            error.code === "SELF_SIGNED_CERT_IN_CHAIN" ||
            error.code === "CERT_HAS_EXPIRED" ||
            error.message.includes("self-signed") ||
            error.message.includes("certificate")) {

          try { socket?.destroy(); } catch { /* ignore */ }

          // Connect without validation to get cert info
          const unsafeSocket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
            const cert = unsafeSocket.getPeerCertificate();
            cleanup();
            try { unsafeSocket.destroy(); } catch { /* ignore */ }

            if (cert.fingerprint256) {
              const isSelfSigned = error.code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
                error.code === "SELF_SIGNED_CERT_IN_CHAIN" ||
                error.message.includes("self-signed");
              const subjectObj = cert.subject as { CN?: string; O?: string } | undefined;
              const issuerObj = cert.issuer as { CN?: string; O?: string } | undefined;

              resolve({
                success: false,
                error: isSelfSigned ? "Self-signed certificate" : error.message,
                errorCode: error.code ?? "CERT_ERROR",
                certificateInfo: {
                  fingerprint256: cert.fingerprint256,
                  subject: typeof cert.subject === "string" ? cert.subject :
                    (subjectObj?.CN ?? subjectObj?.O ?? "Unknown"),
                  issuer: typeof cert.issuer === "string" ? cert.issuer :
                    (issuerObj?.CN ?? issuerObj?.O ?? "Unknown"),
                  validFrom: cert.valid_from,
                  validTo: cert.valid_to,
                  selfSigned: isSelfSigned,
                },
              });
            } else {
              resolve({
                success: false,
                error: error.message,
                errorCode: error.code || "CERT_ERROR",
              });
            }
          });

          unsafeSocket.on("error", (_unsafeError) => {
            // Try to get certificate even if there was an error
            const cert = unsafeSocket.getPeerCertificate();
            cleanup();

            if (cert.fingerprint256) {
              const isSelfSigned = error.code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
                error.code === "SELF_SIGNED_CERT_IN_CHAIN" ||
                error.message.includes("self-signed");
              const subjectObj = cert.subject as { CN?: string; O?: string } | undefined;
              const issuerObj = cert.issuer as { CN?: string; O?: string } | undefined;

              resolve({
                success: false,
                error: isSelfSigned ? "Self-signed certificate" : error.message,
                errorCode: error.code ?? "CERT_ERROR",
                certificateInfo: {
                  fingerprint256: cert.fingerprint256,
                  subject: typeof cert.subject === "string" ? cert.subject :
                    (subjectObj?.CN ?? subjectObj?.O ?? "Unknown"),
                  issuer: typeof cert.issuer === "string" ? cert.issuer :
                    (issuerObj?.CN ?? issuerObj?.O ?? "Unknown"),
                  validFrom: cert.valid_from,
                  validTo: cert.valid_to,
                  selfSigned: isSelfSigned,
                },
              });
            } else {
              resolve({
                success: false,
                error: error.message,
                errorCode: error.code || "CERT_ERROR",
              });
            }
          });
        } else {
          cleanup();
          resolve({
            success: false,
            error: error.message,
            errorCode: error.code || "CONNECTION_ERROR",
          });
        }
      });
    } catch (error) {
      cleanup();
      resolve({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: "CONNECTION_ERROR",
      });
    }
  });
}

/**
 * Probe certificate over STARTTLS connection.
 * This connects via plain TCP, sends STARTTLS command, upgrades to TLS
 * with validation disabled (since we're probing for self-signed certs),
 * then extracts the certificate info.
 */
export function probeStarttlsCertificate(
  host: string,
  port: number,
  timeoutMs = 10000
): Promise<TlsProbeResult> {
  return new Promise((resolve) => {
    let socket: net.Socket | tls.TLSSocket | undefined;
    let resolved = false;
    let dataBuffer = "";
    let greetingReceived = false;
    let starttlsSent = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        try { socket?.destroy(); } catch { /* ignore */ }
      }
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ success: false, error: "Connection timed out", errorCode: "TIMEOUT" });
    }, timeoutMs);

    const handleData = (data: Buffer) => {
      dataBuffer += data.toString();

      // Check for IMAP greeting
      if (!greetingReceived && (dataBuffer.includes("* OK") || dataBuffer.includes("* PREAUTH"))) {
        greetingReceived = true;

        // Parse capabilities to check for STARTTLS support
        const capMatch = dataBuffer.match(/\[CAPABILITY ([^\]]+)\]/i) || dataBuffer.match(/\* CAPABILITY (.+)/i);
        const capabilities = capMatch?.[1]?.split(" ").filter(c => c.length > 0) || [];
        const hasStarttls = capabilities.some(c => c.toUpperCase() === "STARTTLS");

        if (!hasStarttls) {
          clearTimeout(timeout);
          cleanup();
          resolve({ success: false, error: "Server does not support STARTTLS", errorCode: "NO_STARTTLS" });
          return;
        }

        // Send STARTTLS command
        starttlsSent = true;
        dataBuffer = ""; // Clear buffer for response
        socket?.write("A001 STARTTLS\r\n");
      }

      // Handle STARTTLS response
      if (starttlsSent && dataBuffer.includes("A001 OK")) {
        // Server accepted STARTTLS, now upgrade to TLS
        const plainSocket = socket as net.Socket;

        // SECURITY: rejectUnauthorized: false is intentional here.
        // This is a certificate inspection tool that retrieves cert info from
        // servers with self-signed certificates so users can review and trust them.
        // The connection is immediately closed after retrieving cert info - no data
        // is sent or received. This is the standard pattern for certificate pinning UIs.
        const tlsSocket = tls.connect({
          socket: plainSocket,
          host,
          rejectUnauthorized: false, // lgtm[js/disabling-certificate-validation]
        }, () => {
          const cert = tlsSocket.getPeerCertificate();
          clearTimeout(timeout);
          try { tlsSocket.destroy(); } catch { /* ignore */ }
          resolved = true;

          if (cert.fingerprint256) {
            // Determine if self-signed by comparing subject and issuer
            const subjectObj = cert.subject as { CN?: string; O?: string } | undefined;
            const issuerObj = cert.issuer as { CN?: string; O?: string } | undefined;
            const subjectStr = typeof cert.subject === "string" ? cert.subject :
              (subjectObj?.CN ?? subjectObj?.O ?? "");
            const issuerStr = typeof cert.issuer === "string" ? cert.issuer :
              (issuerObj?.CN ?? issuerObj?.O ?? "");
            const isSelfSigned = subjectStr === issuerStr;

            resolve({
              success: false, // Always false because we disabled validation
              error: isSelfSigned ? "Self-signed certificate" : "Certificate validation skipped",
              errorCode: isSelfSigned ? "DEPTH_ZERO_SELF_SIGNED_CERT" : "CERT_VALIDATION_DISABLED",
              certificateInfo: {
                fingerprint256: cert.fingerprint256,
                subject: subjectStr || "Unknown",
                issuer: issuerStr || "Unknown",
                validFrom: cert.valid_from,
                validTo: cert.valid_to,
                selfSigned: isSelfSigned,
              },
            });
          } else {
            resolve({
              success: false,
              error: "Could not retrieve certificate details",
              errorCode: "NO_CERT_INFO",
            });
          }
        });

        tlsSocket.on("error", (error: NodeJS.ErrnoException) => {
          clearTimeout(timeout);
          cleanup();
          resolve({
            success: false,
            error: error.message,
            errorCode: error.code || "TLS_ERROR",
          });
        });

        socket = tlsSocket;
      } else if (starttlsSent && (dataBuffer.includes("A001 NO") || dataBuffer.includes("A001 BAD"))) {
        clearTimeout(timeout);
        cleanup();
        resolve({ success: false, error: "STARTTLS command rejected by server", errorCode: "STARTTLS_REJECTED" });
      }
    };

    try {
      socket = net.connect({ host, port }, () => {
        // TCP connection established, wait for IMAP greeting
      });

      socket.on("data", handleData);
      socket.on("error", (error: Error) => {
        clearTimeout(timeout);
        cleanup();
        resolve({
          success: false,
          error: error.message,
          errorCode: (error as NodeJS.ErrnoException).code || "CONNECTION_ERROR",
        });
      });
      socket.on("close", () => {
        if (!resolved) {
          clearTimeout(timeout);
          resolved = true;
          resolve({ success: false, error: "Connection closed", errorCode: "CONNECTION_CLOSED" });
        }
      });
    } catch (error) {
      clearTimeout(timeout);
      cleanup();
      resolve({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: "CONNECTION_ERROR",
      });
    }
  });
}

export async function probeImapPort(
  host: string,
  port: number,
  tlsMode: "tls" | "starttls" | "none",
  timeoutMs = 5000
): Promise<PortProbeResult> {
  return new Promise((resolve) => {
    let socket: net.Socket | tls.TLSSocket | undefined;
    let resolved = false;
    let dataBuffer = "";
    let capabilities: string[] = [];
    let greetingReceived = false;
    let starttlsSent = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        try { socket?.destroy(); } catch { /* ignore */ }
      }
    };

    const finishSuccess = () => {
      clearTimeout(timeout);
      cleanup();
      const authMethods: ("basic" | "oauth2")[] = ["basic"];
      if (capabilities.some(cap => cap.toUpperCase().includes("AUTH=XOAUTH2"))) {
        authMethods.push("oauth2");
      }
      resolve({ port, tls: tlsMode, success: true, capabilities, authMethods });
    };

    const finishFailure = () => {
      clearTimeout(timeout);
      cleanup();
      resolve({ port, tls: tlsMode, success: false });
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ port, tls: tlsMode, success: false });
    }, timeoutMs);

    const parseCapabilities = (data: string) => {
      // Parse capabilities from greeting or CAPABILITY response
      const capMatch = data.match(/\[CAPABILITY ([^\]]+)\]/i) || data.match(/\* CAPABILITY (.+)/i);
      if (capMatch?.[1]) {
        capabilities = capMatch[1].split(" ").filter(c => c.length > 0);
      }
    };

    const handleData = (data: Buffer) => {
      dataBuffer += data.toString();

      // Check for IMAP greeting
      if (!greetingReceived && (dataBuffer.includes("* OK") || dataBuffer.includes("* PREAUTH"))) {
        greetingReceived = true;
        parseCapabilities(dataBuffer);

        if (tlsMode === "tls" || tlsMode === "none") {
          // For TLS mode, we already connected via TLS - success
          // For none/insecure mode, plaintext connection works - success
          finishSuccess();
          return;
        }

        // For STARTTLS mode, check if server supports it and try to upgrade
        // At this point, tlsMode must be "starttls" (tls and none already handled above)
        const hasStarttls = capabilities.some(c => c.toUpperCase() === "STARTTLS");
        if (!hasStarttls) {
          // Server doesn't support STARTTLS
          finishFailure();
          return;
        }
        // Send STARTTLS command
        starttlsSent = true;
        socket?.write("A001 STARTTLS\r\n");
      }

      // Handle STARTTLS response
      if (starttlsSent && dataBuffer.includes("A001 OK")) {
        // Server accepted STARTTLS, now upgrade to TLS
        const plainSocket = socket as net.Socket;
        const tlsSocket = tls.connect({
          socket: plainSocket,
          host,
          rejectUnauthorized: false,
        }, () => {
          // TLS upgrade successful
          finishSuccess();
        });
        tlsSocket.on("error", finishFailure);
        socket = tlsSocket;
      } else if (starttlsSent && (dataBuffer.includes("A001 NO") || dataBuffer.includes("A001 BAD"))) {
        // STARTTLS command failed
        finishFailure();
      }
    };

    const handleError = () => {
      finishFailure();
    };

    try {
      if (tlsMode === "tls") {
        // Connect directly with TLS
        socket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
          // TLS handshake successful, wait for IMAP greeting
        });
      } else {
        // Connect via plain TCP (for both starttls and none modes)
        socket = net.connect({ host, port }, () => {
          // TCP connection established, wait for IMAP greeting
        });
      }

      socket.on("data", handleData);
      socket.on("error", handleError);
      socket.on("close", () => {
        if (!resolved) {
          finishFailure();
        }
      });
    } catch {
      finishFailure();
    }
  });
}

export interface ImapProviderInfo {
  name: string;
  type: string;
  requiresOAuth: boolean;
  oauthSupported: boolean;
}

/**
 * Check if hostname matches a domain exactly or is a subdomain of it.
 * E.g., matchesDomain("mail.me.com", "me.com") returns true,
 *       matchesDomain("maliciousme.com", "me.com") returns false.
 */
function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * Extract a normalized hostname from a host string.
 * Handles both plain hostnames and URLs.
 */
function normalizeHostname(host: string): string {
  let hostname = host.toLowerCase().trim();

  // If it looks like a URL, parse it
  if (hostname.includes("://")) {
    try {
      const url = new URL(hostname);
      hostname = url.hostname;
    } catch {
      // If URL parsing fails, continue with original value
    }
  }

  // Strip trailing dots (FQDN normalization)
  hostname = hostname.replace(/\.+$/, "");

  return hostname;
}

export function detectImapProvider(host: string): ImapProviderInfo {
  const hostname = normalizeHostname(host);

  // Brand-based matching (safe to use includes for these non-TLD-like strings)
  if (hostname.includes("gmail") || hostname.includes("google")) {
    return {
      name: "Gmail",
      type: "gmail",
      requiresOAuth: false,
      oauthSupported: true,
    };
  }

  if (hostname.includes("outlook") || hostname.includes("office365") || hostname.includes("microsoft")) {
    return {
      name: "Microsoft Outlook",
      type: "outlook",
      requiresOAuth: false,
      oauthSupported: true,
    };
  }

  if (hostname.includes("yahoo")) {
    return {
      name: "Yahoo Mail",
      type: "yahoo",
      requiresOAuth: false,
      oauthSupported: true,
    };
  }

  if (hostname.includes("fastmail")) {
    return {
      name: "Fastmail",
      type: "fastmail",
      requiresOAuth: false,
      oauthSupported: false,
    };
  }

  if (hostname.includes("zoho")) {
    return {
      name: "Zoho Mail",
      type: "zoho",
      requiresOAuth: false,
      oauthSupported: true,
    };
  }

  // Domain-based matching (use proper domain suffix checking for actual domains)
  if (hostname.includes("icloud") ||
      hostname.includes("apple") ||
      matchesDomain(hostname, "me.com") ||
      matchesDomain(hostname, "icloud.com") ||
      matchesDomain(hostname, "mac.com")) {
    return {
      name: "iCloud Mail",
      type: "icloud",
      requiresOAuth: false,
      oauthSupported: false,
    };
  }

  return {
    name: "Generic IMAP",
    type: "generic",
    requiresOAuth: false,
    oauthSupported: false,
  };
}
