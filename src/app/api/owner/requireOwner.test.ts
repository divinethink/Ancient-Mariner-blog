import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { requireOwner } from "./requireOwner";
import { SESSION_COOKIE, createSessionToken } from "@/lib/session";

const SECRET = "s".repeat(40);
const OWNER = "ownerUid1234567890";
const saved = { ...process.env };
const req = (cookie?: string) =>
  new NextRequest("https://blog.example.workers.dev/api/owner/rebuild", {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });

beforeEach(() => {
  Object.assign(process.env, {
    FIREBASE_PROJECT_ID: "p",
    SITE_URL: "https://blog.example.workers.dev",
    OWNER_UID: OWNER,
    SESSION_SECRET: SECRET,
  });
});
afterEach(() => {
  process.env = { ...saved };
});

describe("requireOwner", () => {
  it("বৈধ owner-session ⇒ null (চলতে দেয়)", async () => {
    const t = await createSessionToken(SECRET, OWNER);
    expect(await requireOwner(req(`${SESSION_COOKIE}=${t}`))).toBeNull();
  });
  it("cookie নেই / ভুল / tamper / অন্য owner / ভুল secret ⇒ ৪০১", async () => {
    const good = await createSessionToken(SECRET, OWNER);
    const cases = [
      undefined,
      `${SESSION_COOKIE}=abc`,
      `${SESSION_COOKIE}=${good.slice(0, -2)}xx`,
      `${SESSION_COOKIE}=${await createSessionToken(SECRET, "someoneElse12345")}`,
      `${SESSION_COOKIE}=${await createSessionToken("x".repeat(40), OWNER)}`,
    ];
    for (const c of cases) {
      const r = await requireOwner(req(c));
      expect(r?.status).toBe(401);
    }
  });
  it("মেয়াদ-শেষ session ⇒ ৪০১", async () => {
    const old = await createSessionToken(
      SECRET,
      OWNER,
      Math.floor(Date.now() / 1000) - 6 * 24 * 3600,
    );
    expect((await requireOwner(req(`${SESSION_COOKIE}=${old}`)))?.status).toBe(401);
  });
  it("env অসম্পূর্ণ ⇒ ৫০০ (fail-closed, কখনো null নয়)", async () => {
    delete process.env.SESSION_SECRET;
    const t = await createSessionToken(SECRET, OWNER);
    expect((await requireOwner(req(`${SESSION_COOKIE}=${t}`)))?.status).toBe(500);
  });
});
