// পরিসংখ্যান পড়া (P11a-২; Arch §২ privileged ৫, §৭): owner-only (`middleware.ts` session যাচাই করে), শুধু D1 SELECT।
// GET — কিছু বদলায় না, তাই CSRF-Origin যাচাই লাগে না; response no-store (cache-এ ব্যক্তিগত পরিসংখ্যান থাকে না)।
import { NextResponse, type NextRequest } from "next/server";
import { getViewEnv } from "@/config/env";
import { getCounterDb, readStats } from "@/data/counterRepo";
import { createLogger } from "@/lib/logger";
import { isStatsRange, statsWindow } from "@/lib/stats";

export const dynamic = "force-dynamic";

const log = createLogger();
const noStore = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get("range") ?? "7d";
  if (!isStatsRange(range)) return NextResponse.json({ error: "bad_range" }, { status: 400, headers: noStore });
  let tz: string;
  try {
    tz = getViewEnv().SITE_TIMEZONE; // D1-এ `day` যে timezone-এ লেখা হয়েছে (`/api/view`) ঠিক সেটাই
  } catch (e) {
    log.error("stats env misconfigured", { detail: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
    return NextResponse.json({ error: "misconfigured" }, { status: 500, headers: noStore });
  }
  const db = getCounterDb();
  if (!db) return NextResponse.json({ error: "no_db" }, { status: 503, headers: noStore });
  const w = statsWindow(range, Date.now(), tz);
  try {
    const data = await readStats(db, w);
    return NextResponse.json({ range, from: w.from, to: w.to, bucket: w.bucket, ...data }, { headers: noStore });
  } catch (e) {
    log.error("stats read failed", { detail: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
    return NextResponse.json({ error: "read_failed" }, { status: 502, headers: noStore });
  }
}
