// নতুন-প্রকাশ তাৎক্ষণিক (A-lite): ব্র্যান্ডেড 404 পেজের ছোট অংশ ডাকে; শুধু ওই এক published+public লেখা ফেরায়।
// GET-only, লগইন লাগে না (পাবলিক ডেটা); `middleware.ts`-এর বাইরে। না পেলে/ব্যর্থ হলে পাঠক সাধারণ 404-ই দেখে।
import { NextResponse } from "next/server";
import { getLiveEnv } from "@/config/env";
import { fetchLivePost, parseLiveSlug } from "@/data/liveRead";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger();
const noStore = { "Cache-Control": "no-store" };

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const slug = parseLiveSlug((await ctx.params).slug);
  if (!slug) return NextResponse.json({ error: "bad_request" }, { status: 400, headers: noStore });
  let env: ReturnType<typeof getLiveEnv>;
  try {
    env = getLiveEnv();
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore }); // key বসেনি — আগের আচরণ (সাধারণ 404)
  }
  try {
    const post = await fetchLivePost({ projectId: env.FIREBASE_PROJECT_ID, apiKey: env.FIREBASE_SERVER_API_KEY, slug });
    if (!post) return NextResponse.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "public, max-age=5" } });
    return NextResponse.json({ post }, { headers: { "Cache-Control": "public, max-age=10" } });
  } catch (e) {
    log.warn("live.read.fail", { detail: (e instanceof Error ? e.message : String(e)).slice(0, 120) });
    return NextResponse.json({ error: "failed" }, { status: 502, headers: noStore });
  }
}
