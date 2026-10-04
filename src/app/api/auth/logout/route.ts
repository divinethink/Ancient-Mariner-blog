// cookie মোছা (Arch §৫)। POST-only + Origin যাচাই; লোকাল ডেটা মোছা ক্লায়েন্টে (`auth/authClient.ts`)।
import { NextResponse, type NextRequest } from "next/server";
import { getAuthEnv } from "@/config/env";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, isSameOrigin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let siteUrl: string;
  try {
    siteUrl = getAuthEnv().SITE_URL;
  } catch {
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }
  if (!isSameOrigin(req.headers.get("origin"), siteUrl)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
