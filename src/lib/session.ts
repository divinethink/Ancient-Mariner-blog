// Session/Auth বিশুদ্ধ লজিক (Arch §৫): Firebase ID token যাচাই, নিজস্ব session JWT, Origin/redirect যাচাই।
// Firebase SDK/React-মুক্ত — `jose` শুধু; middleware ও route handler একই ফাংশন reuse করে (duplicate নিষিদ্ধ)।
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTVerifyGetKey } from "jose";

export const SESSION_COOKIE = "__session";
export const SESSION_TTL_SEC = 5 * 24 * 60 * 60; // ৫ দিন rolling
const REFRESH_AFTER_SEC = 24 * 60 * 60; // ১ দিনের পুরনো হলে নতুন মেয়াদ
const GOOGLE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SEC,
};

let remoteKeys: JWTVerifyGetKey | undefined;
function googleKeys(): JWTVerifyGetKey {
  remoteKeys ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  return remoteKeys;
}

export type IdTokenResult =
  | { ok: true; uid: string }
  | { ok: false; reason: "invalid" | "not-owner"; detail?: string };

/** Firebase ID token: signature + iss/aud/exp + Google provider + সাম্প্রতিক sign-in + sub==OWNER_UID */
export async function verifyIdToken(
  idToken: string,
  cfg: { projectId: string; ownerUid: string; maxAuthAgeSec?: number },
  opts: { getKey?: JWTVerifyGetKey; now?: Date } = {},
): Promise<IdTokenResult> {
  const now = opts.now ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  try {
    const { payload } = await jwtVerify(idToken, opts.getKey ?? googleKeys(), {
      issuer: `https://securetoken.google.com/${cfg.projectId}`,
      audience: cfg.projectId,
      algorithms: ["RS256"],
      currentDate: now,
      clockTolerance: 5,
    });
    const provider = (payload.firebase as { sign_in_provider?: string } | undefined)
      ?.sign_in_provider;
    const authTime = payload.auth_time;
    if (typeof payload.sub !== "string" || payload.sub === "") return { ok: false, reason: "invalid" };
    if (provider !== "google.com") return { ok: false, reason: "invalid", detail: "provider" };
    if (
      typeof authTime !== "number" ||
      authTime > nowSec + 5 ||
      nowSec - authTime > (cfg.maxAuthAgeSec ?? 300)
    ) {
      return { ok: false, reason: "invalid", detail: "auth_time" };
    }
    if (payload.sub !== cfg.ownerUid) return { ok: false, reason: "not-owner" };
    return { ok: true, uid: payload.sub };
  } catch (e) {
    return { ok: false, reason: "invalid", detail: e instanceof Error ? e.name : "unknown" };
  }
}

const key = (secret: string) => new TextEncoder().encode(secret);

export async function createSessionToken(
  secret: string,
  ownerUid: string,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(ownerUid)
    .setIssuedAt(nowSec)
    .setExpirationTime(nowSec + SESSION_TTL_SEC)
    .sign(key(secret));
}

/** বৈধ হলে { iat }, নইলে null (tamper/মেয়াদ-শেষ/ভুল secret/ভুল owner) */
export async function verifySessionToken(
  token: string,
  secret: string,
  ownerUid: string,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<{ iat: number } | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
      subject: ownerUid,
      currentDate: new Date(nowSec * 1000),
    });
    return typeof payload.iat === "number" ? { iat: payload.iat } : null;
  } catch {
    return null;
  }
}

export function needsRefresh(iat: number, nowSec = Math.floor(Date.now() / 1000)): boolean {
  return nowSec - iat > REFRESH_AFTER_SEC;
}

/** CSRF: state-changing POST-এ Origin == SITE_URL-এর origin (SameSite=Lax-এর সাথে) */
export function isSameOrigin(origin: string | null, siteUrl: string): boolean {
  if (!origin) return false;
  try {
    return origin === new URL(siteUrl).origin;
  } catch {
    return false;
  }
}

/** login-পরবর্তী redirect: শুধু /dashboard-এর ভেতরের পথ (open-redirect নয়) */
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return "/dashboard";
  return /^\/dashboard(?:[/?#][^\\]*)?$/.test(raw) && !raw.includes("//") ? raw : "/dashboard";
}
