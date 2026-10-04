import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_SEC,
  createSessionToken,
  isSameOrigin,
  needsRefresh,
  safeNext,
  verifyIdToken,
  verifySessionToken,
} from "./session";

const PROJECT = "proj";
const OWNER = "owner-uid";
const NOW = new Date("2026-10-04T12:00:00Z");
const NOW_SEC = Math.floor(NOW.getTime() / 1000);
const cfg = { projectId: PROJECT, ownerUid: OWNER };

async function keys() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), alg: "RS256", kid: "k1" };
  return { privateKey, getKey: createLocalJWKSet({ keys: [jwk] }) };
}

type Over = { sub?: string; aud?: string; iss?: string; exp?: number; authTime?: number; provider?: string };
async function idToken(privateKey: CryptoKey, o: Over = {}) {
  return new SignJWT({
    auth_time: o.authTime ?? NOW_SEC - 20,
    firebase: { sign_in_provider: o.provider ?? "google.com" },
  })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setSubject(o.sub ?? OWNER)
    .setAudience(o.aud ?? PROJECT)
    .setIssuer(o.iss ?? `https://securetoken.google.com/${PROJECT}`)
    .setIssuedAt(NOW_SEC - 20)
    .setExpirationTime(o.exp ?? NOW_SEC + 3600)
    .sign(privateKey);
}

describe("verifyIdToken", () => {
  it("বৈধ owner token", async () => {
    const { privateKey, getKey } = await keys();
    const r = await verifyIdToken(await idToken(privateKey), cfg, { getKey, now: NOW });
    expect(r).toEqual({ ok: true, uid: OWNER });
  });
  it("অন্য uid → not-owner", async () => {
    const { privateKey, getKey } = await keys();
    const r = await verifyIdToken(await idToken(privateKey, { sub: "x" }), cfg, { getKey, now: NOW });
    expect(r).toMatchObject({ ok: false, reason: "not-owner" });
  });
  it.each([
    ["ভুল aud", { aud: "other" }],
    ["ভুল iss", { iss: "https://securetoken.google.com/other" }],
    ["মেয়াদ-শেষ", { exp: NOW_SEC - 100 }],
    ["Google ছাড়া provider", { provider: "password" }],
    ["পুরনো sign-in (auth_time)", { authTime: NOW_SEC - 1000 }],
  ] as [string, Over][])("%s → invalid", async (_n, over) => {
    const { privateKey, getKey } = await keys();
    const r = await verifyIdToken(await idToken(privateKey, over), cfg, { getKey, now: NOW });
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("অন্য key-র signature → invalid", async () => {
    const a = await keys();
    const b = await keys();
    const r = await verifyIdToken(await idToken(b.privateKey), cfg, { getKey: a.getKey, now: NOW });
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("garbage → invalid", async () => {
    const { getKey } = await keys();
    expect(await verifyIdToken("abc.def.ghi", cfg, { getKey, now: NOW })).toMatchObject({ ok: false });
  });
});

describe("session token", () => {
  const SECRET = "s".repeat(32);
  it("roundtrip", async () => {
    const t = await createSessionToken(SECRET, OWNER, NOW_SEC);
    expect(await verifySessionToken(t, SECRET, OWNER, NOW_SEC + 10)).toEqual({ iat: NOW_SEC });
  });
  it("ভুল secret / ভুল owner / tamper → null", async () => {
    const t = await createSessionToken(SECRET, OWNER, NOW_SEC);
    expect(await verifySessionToken(t, "x".repeat(32), OWNER, NOW_SEC)).toBeNull();
    expect(await verifySessionToken(t, SECRET, "other", NOW_SEC)).toBeNull();
    expect(await verifySessionToken(t.slice(0, -2) + "AA", SECRET, OWNER, NOW_SEC)).toBeNull();
  });
  it("মেয়াদ-শেষ → null", async () => {
    const t = await createSessionToken(SECRET, OWNER, NOW_SEC);
    expect(await verifySessionToken(t, SECRET, OWNER, NOW_SEC + SESSION_TTL_SEC + 1)).toBeNull();
  });
  it("rolling: ১ দিনের পরে refresh", () => {
    expect(needsRefresh(NOW_SEC, NOW_SEC + 3600)).toBe(false);
    expect(needsRefresh(NOW_SEC, NOW_SEC + 86400 + 1)).toBe(true);
  });
});

describe("isSameOrigin", () => {
  const site = "https://blog.ancientmariner.workers.dev";
  it("মেলে / মেলে না", () => {
    expect(isSameOrigin("https://blog.ancientmariner.workers.dev", site)).toBe(true);
    expect(isSameOrigin("https://evil.example", site)).toBe(false);
    expect(isSameOrigin(null, site)).toBe(false);
    expect(isSameOrigin("https://blog.ancientmariner.workers.dev", "not a url")).toBe(false);
  });
});

describe("safeNext", () => {
  it("শুধু /dashboard-এর ভেতর", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/dashboard/posts/new?x=1")).toBe("/dashboard/posts/new?x=1");
    for (const bad of ["//evil.com", "https://evil.com", "/dashboardx", "/login", "/dashboard//evil", "/dashboard\\x", undefined, 5]) {
      expect(safeNext(bad)).toBe("/dashboard");
    }
  });
});
