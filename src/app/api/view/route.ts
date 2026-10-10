// পাবলিক view-beacon (P11a-১; Arch §২ privileged ৫, §৭)। লগইন-ছাড়া POST: Origin যাচাই + bot/owner বাদ + দৈনিক salted-hash dedupe।
// পাঠককে কখনো error দেখানো হয় না — বৈধ-আকারের অনুরোধে সবসময় 204 (D1 না থাকলে/ব্যর্থ হলেও); শুধু আকার-ভুলে 400, Origin-ভুলে 403।
import { NextResponse, type NextRequest } from "next/server";
import { getAuthEnv, getViewEnv } from "@/config/env";
import { getCounterDb, recordView } from "@/data/counterRepo";
import { dayKey } from "@/lib/datetime";
import { createLogger } from "@/lib/logger";
import { SESSION_COOKIE, isSameOrigin, verifySessionToken } from "@/lib/session";
import { isBotUa, normalizeCountry, parseViewPayload, postViewKey, visitorHash, visitorKey } from "@/lib/views";

export const dynamic = "force-dynamic";

const log = createLogger();
const noStore = { "Cache-Control": "no-store" };
const done = () => new NextResponse(null, { status: 204, headers: noStore });

/** owner নিজের সাইট ঘুরলে গণনা নয় (cookie যাচাই; ব্যর্থ হলে সাধারণ ভিজিটর ধরা) */
async function isOwner(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    const a = getAuthEnv();
    return (await verifySessionToken(token, a.SESSION_SECRET, a.OWNER_UID)) !== null;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let env: ReturnType<typeof getViewEnv>;
  try {
    env = getViewEnv();
  } catch (e) {
    log.error("view env misconfigured", { detail: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
    return done(); // গণনা বন্ধ, পাঠক অক্ষত
  }
  if (!isSameOrigin(req.headers.get("origin"), env.SITE_URL)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });
  if (Number(req.headers.get("content-length") ?? 0) > 1024) return NextResponse.json({ error: "too_large" }, { status: 413, headers: noStore });
  const payload = parseViewPayload(await req.json().catch(() => null), new URL(env.SITE_URL).hostname);
  if (!payload) return NextResponse.json({ error: "bad_request" }, { status: 400, headers: noStore });

  const ua = req.headers.get("user-agent");
  if (isBotUa(ua) || (await isOwner(req))) return done();
  const db = getCounterDb();
  if (!db) return done();

  try {
    const day = dayKey(Date.now(), env.SITE_TIMEZONE);
    const h = await visitorHash(env.VIEW_HASH_SALT, req.headers.get("cf-connecting-ip") ?? "", ua ?? "", day);
    await recordView(db, {
      postId: payload.postId,
      day,
      country: normalizeCountry(req.headers.get("cf-ipcountry")),
      referrer: payload.referrer,
      visitorKey: visitorKey(h),
      postKey: postViewKey(payload.postId, h),
    });
  } catch (e) {
    log.warn("view record failed", { detail: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
  }
  return done();
}
