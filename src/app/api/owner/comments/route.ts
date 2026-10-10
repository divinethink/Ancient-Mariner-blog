// মালিকের মন্তব্য-ব্যবস্থাপনা (P11b-২; Arch §২ privileged ১): লুকানো/ফেরানো, মোছা, উত্তর। `middleware.ts` session যাচাই করে (/api/owner/*); এখানে POST-only + Origin (CSRF)।
// সব ক্রিয়া idempotent; সফল হলে 'rebuild বাকি' চিহ্ন (Cron ≤১৫ মিনিটে সাইট হালনাগাদ করে; ড্যাশবোর্ডে 'এখনই' বোতামও আছে)।
import { NextResponse, type NextRequest } from "next/server";
import { getOwnerCommentEnv } from "@/config/env";
import { getCounterDb, markRebuildDirty } from "@/data/counterRepo";
import { removeComment, replyAsOwner, setStatus, type ModerateResult } from "@/data/privileged/commentModerate";
import { createAdminDb, createBudget } from "@/data/privileged/firestoreAdmin";
import { createTokenProvider, parseServiceAccount } from "@/data/privileged/googleAuth";
import { parseOwnerAction, REBUILD_DIRTY_KEY } from "@/lib/comments";
import { dayKey } from "@/lib/datetime";
import { bn } from "@/i18n/bn";
import { createLogger } from "@/lib/logger";
import { isSameOrigin } from "@/lib/session";

export const dynamic = "force-dynamic";

const log = createLogger();
const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

export async function POST(req: NextRequest) {
  let env: ReturnType<typeof getOwnerCommentEnv>;
  try {
    env = getOwnerCommentEnv();
  } catch (e) {
    log.error("owner comments env misconfigured", { detail: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
    return fail("misconfigured", 500);
  }
  if (!isSameOrigin(req.headers.get("origin"), env.SITE_URL)) return fail("forbidden", 403);
  if (Number(req.headers.get("content-length") ?? 0) > 16 * 1024) return fail("too_large", 413);
  const action = parseOwnerAction(await req.json().catch(() => null));
  if (!action) return fail("bad_request", 400);

  try {
    const now = Date.now();
    const budget = createBudget();
    const db = createAdminDb({
      projectId: env.FIREBASE_PROJECT_ID,
      budget,
      getToken: createTokenProvider({ serviceAccount: parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT), onRequest: () => budget.spend() }),
    });
    let r: ModerateResult;
    if (action.action === "status") r = await setStatus(db, action.id, action.status, now);
    else if (action.action === "delete") r = await removeComment(db, action.id);
    else r = await replyAsOwner(db, action, env.OWNER_UID, bn.comments.ownerName, now);
    if (r.kind === "not_found") return fail("not_found", 404);
    if (r.kind === "bad_parent") return fail("bad_parent", 422);
    if (r.kind === "conflict") return fail("conflict", 409);
    // চিহ্ন বসানো best-effort: না বসলেও কাজ সম্পন্ন (৩-ঘণ্টার deploy তুলে নেবে)
    const d1 = getCounterDb();
    if (d1) await markRebuildDirty(d1, REBUILD_DIRTY_KEY, dayKey(now, env.SITE_TIMEZONE)).catch(() => undefined);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    log.error("owner comment action failed", { detail: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
    return fail("unavailable", 503);
  }
}
