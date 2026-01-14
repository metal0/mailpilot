import { createLogger } from "../utils/logger.js";

const logger = createLogger("imap-oauth");

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenCache>();

export async function getAccessToken(
  provider: "gmail" | "outlook",
  credentials: OAuthCredentials
): Promise<string> {
  const cacheKey = `${provider}:${credentials.clientId}`;
  const cached = tokenCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.accessToken;
  }

  logger.debug("Refreshing OAuth token", { provider });

  const tokenUrl = getTokenUrl(provider);
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: credentials.refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth token refresh failed: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as TokenResponse;

  tokenCache.set(cacheKey, {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });

  logger.debug("OAuth token refreshed", {
    provider,
    expiresIn: data.expires_in,
  });

  return data.access_token;
}

function getTokenUrl(provider: "gmail" | "outlook"): string {
  switch (provider) {
    case "gmail":
      return "https://oauth2.googleapis.com/token";
    case "outlook":
      return "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  }
}

export function buildXOAuth2Token(user: string, accessToken: string): string {
  const authString = `user=${user}\x01auth=Bearer ${accessToken}\x01\x01`;
  return Buffer.from(authString).toString("base64");
}

export function clearTokenCache(provider?: string, clientId?: string): void {
  if (provider && clientId) {
    tokenCache.delete(`${provider}:${clientId}`);
  } else {
    tokenCache.clear();
  }
}
