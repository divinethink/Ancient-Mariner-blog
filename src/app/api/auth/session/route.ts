// Google ID token → owner-যাচাই → `__session` cookie (Arch §৫)। POST-only + Origin যাচাই (CSRF)।
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthEnv } from "@/config/env";
import { createLogger } from "@/lib/logger";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  isSameOrigin,
  verifyIdToken,
} from "@/lib/session";

export const dynamic = "force-dynamic";
const log = createLogger();
const Body = z.object({ idToken: z.string().min(20).max(4096) });
const json = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  let env: ReturnType<typeof getAuthEnv>;
  try {
    env = getAuthEnv();
  } catch (e) {
    log.error("auth env misconfigured", { err: e instanceof Error ? e.message : String(e) });
    return json({ error: "misconfigured" }, 500);
  }
  if (!isSameOrigin(req.headers.get("origin"), env.SITE_URL)) return json({ error: "forbidden" }, 403);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad-request" }, 400);

  const r = await verifyIdToken(parsed.data.idToken, {
    projectId: env.FIREBASE_PROJECT_ID,
    ownerUid: env.OWNER_UID,
  });
  if (!r.ok) {
    log.warn("session rejected", { reason: r.reason, detail: r.detail });
    return json({ error: r.reason }, r.reason === "not-owner" ? 403 : 401);
  }

  const res = json({ ok: true }, 200);
  res.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(env.SESSION_SECRET, env.OWNER_UID),
    SESSION_COOKIE_OPTIONS,
  );
  return res;
}
