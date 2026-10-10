// /dashboard/*, /api/owner/*, /login — session যাচাই + কড়া nonce-CSP (Arch §৫, §১৪.৪)।
// edge `middleware.ts` ইচ্ছাকৃত (Next 16 `proxy.ts` Node runtime — OpenNext-এ unsupported)।
import { NextResponse, type NextRequest } from "next/server";
import { getAuthEnv } from "@/config/env";
import { buildAppCsp } from "@/lib/csp";
import { createLogger } from "@/lib/logger";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  needsRefresh,
  safeNext,
  verifySessionToken,
} from "@/lib/session";

const log = createLogger();

function secure(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function middleware(req: NextRequest) {
  let env: ReturnType<typeof getAuthEnv>;
  try {
    env = getAuthEnv();
  } catch (e) {
    log.error("auth env misconfigured", { err: e instanceof Error ? e.message : String(e) });
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token, env.SESSION_SECRET, env.OWNER_UID) : null;

  if (pathname.startsWith("/api/owner")) {
    if (!session) return secure(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
    return secure(await withRefresh(NextResponse.next(), session.iat, env));
  }

  if (pathname === "/login" && session) {
    return secure(NextResponse.redirect(new URL(safeNext(req.nextUrl.searchParams.get("next")), req.url)));
  }
  if (pathname.startsWith("/dashboard") && !session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", safeNext(pathname + search));
    return secure(NextResponse.redirect(url));
  }

  // P11c-২: share পেজ — token URL-এ আছে, তাই referrer যায় না; cache/index নয় (পেজেও noindex metadata আছে)
  const isShare = pathname.startsWith("/share/");

  // পাতা: nonce-CSP (Next নিজের inline script-এ request-header-এর CSP থেকে nonce বসায়)
  const nonce = btoa(crypto.randomUUID());
  const csp = buildAppCsp(nonce, env.FIREBASE_PROJECT_ID);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  const out = secure(session ? await withRefresh(res, session.iat, env) : res);
  if (isShare) {
    out.headers.set("Referrer-Policy", "no-referrer");
    out.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return out;
}

async function withRefresh(
  res: NextResponse,
  iat: number,
  env: ReturnType<typeof getAuthEnv>,
): Promise<NextResponse> {
  if (needsRefresh(iat)) {
    res.cookies.set(
      SESSION_COOKIE,
      await createSessionToken(env.SESSION_SECRET, env.OWNER_UID),
      SESSION_COOKIE_OPTIONS,
    );
  }
  return res;
}

export const config = { matcher: ["/login", "/dashboard", "/dashboard/:path*", "/api/owner/:path*", "/share/:path*"] };
