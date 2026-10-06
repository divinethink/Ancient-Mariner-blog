// Privileged allowlist ৩ (Arch §২): Cron-এর Firestore access-এর জন্য service-account → OAuth2 access token (`jose`, Workers-সামঞ্জস্যপূর্ণ)।
// key/token কখনো log বা error-বার্তায় যায় না। শুধু `src/cron/**` থেকে import (ESLint)।
import { SignJWT, importPKCS8 } from "jose";
import { z } from "zod";
import { withRetry } from "../retry";

export const ServiceAccountSchema = z.object({
  client_email: z.email(),
  private_key: z.string().min(1),
  token_uri: z.url().optional(),
});
export type ServiceAccount = z.infer<typeof ServiceAccountSchema>;

const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
export const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

/** secret-এর JSON-string → যাচাইকৃত service account (ভুল হলে বার্তায় কিছু ফাঁস নয়) */
export function parseServiceAccount(raw: string): ServiceAccount {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT বৈধ JSON নয়");
  }
  const r = ServiceAccountSchema.safeParse(json);
  if (!r.success) throw new Error("FIREBASE_SERVICE_ACCOUNT-এ client_email/private_key নেই");
  return r.data;
}

export type TokenProviderOpts = {
  serviceAccount: ServiceAccount;
  scope?: string;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
  /** প্রতি token-আদানপ্রদানের আগে (subrequest budget গণনা) */
  onRequest?: () => void;
};

/** token cache-সহ provider; মেয়াদের ৬০s আগে নতুন নেয় */
export function createTokenProvider(opts: TokenProviderOpts): () => Promise<string> {
  const {
    serviceAccount: sa,
    scope = DATASTORE_SCOPE,
    fetchImpl = fetch,
    nowMs = Date.now,
    onRequest,
  } = opts;
  const aud = sa.token_uri ?? DEFAULT_TOKEN_URI;
  let cached: { token: string; expMs: number } | null = null;

  return async () => {
    if (cached && cached.expMs - 60_000 > nowMs()) return cached.token;
    const key = await importPKCS8(sa.private_key.replace(/\\n/g, "\n"), "RS256");
    const iat = Math.floor(nowMs() / 1000);
    const assertion = await new SignJWT({ scope })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(sa.client_email)
      .setAudience(aud)
      .setIssuedAt(iat)
      .setExpirationTime(iat + 3600)
      .sign(key);
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    });
    const res = await withRetry(async (signal) => {
      onRequest?.();
      const r = await fetchImpl(aud, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        signal,
      });
      if (!r.ok) throw new Error(`Google token ${r.status}`);
      return (await r.json()) as { access_token?: string; expires_in?: number };
    });
    if (!res.access_token) throw new Error("Google token: access_token নেই");
    cached = { token: res.access_token, expMs: nowMs() + (res.expires_in ?? 3600) * 1000 };
    return cached.token;
  };
}
