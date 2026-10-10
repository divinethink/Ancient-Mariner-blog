// পাবলিক মন্তব্য-জমা (P11b-১; Arch §২ privileged ১, §১৪.২)। লগইন-ছাড়া POST: Origin → আকার → payload → D1 rate-limit → Turnstile → posts/comments (service-account)।
// অবিরাম ব্যর্থতা fail-closed (৫০৩): D1/Turnstile/Firestore যেকোনো একটা না থাকলে মন্তব্য নেওয়া হয় না — পাঠকের পেজ অক্ষত। idempotent: একই commentId ⇒ ২০০ (duplicate নয়)।
// লগে নাম/লেখা/IP কখনো নয়।
import { NextResponse, type NextRequest } from "next/server";
import { getCommentEnv } from "@/config/env";
import { consumeLimit, getCounterDb, markRebuildDirty } from "@/data/counterRepo";
import { submitComment } from "@/data/privileged/commentSubmit";
import { createAdminDb, createBudget } from "@/data/privileged/firestoreAdmin";
import { createTokenProvider, parseServiceAccount } from "@/data/privileged/googleAuth";
import { sendNotice } from "@/data/privileged/notify";
import { verifyTurnstile } from "@/data/privileged/turnstile";
import { commentDayKey, commentHourKey, MAX_COMMENTS_PER_DAY, MAX_COMMENTS_PER_HOUR, parseCommentPayload, REBUILD_DIRTY_KEY } from "@/lib/comments";
import { dayKey } from "@/lib/datetime";
import { createLogger } from "@/lib/logger";
import { isSameOrigin } from "@/lib/session";
import { visitorHash } from "@/lib/views";

export const dynamic = "force-dynamic";

const log = createLogger();
const headers = { "Cache-Control": "no-store" };
const reply = (error: string | null, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json(error ? { error } : { ok: true, ...extra }, { status, headers });

/** ফর্ম ফোকাসে Turnstile site-key জানতে (পাবলিক মান, গোপন নয়); না থাকলে ফর্ম 'এখন বন্ধ' দেখায় */
export async function GET() {
  try {
    const key = getCommentEnv().TURNSTILE_SITE_KEY;
    return key ? NextResponse.json({ siteKey: key }, { headers }) : reply("unavailable", 503);
  } catch {
    return reply("unavailable", 503);
  }
}

export async function POST(req: NextRequest) {
  let env: ReturnType<typeof getCommentEnv>;
  try {
    env = getCommentEnv();
  } catch (e) {
    log.error("comment env misconfigured", { detail: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
    return reply("unavailable", 503);
  }
  if (!isSameOrigin(req.headers.get("origin"), env.SITE_URL)) return reply("forbidden", 403);
  if (Number(req.headers.get("content-length") ?? 0) > 16 * 1024) return reply("too_large", 413);
  const payload = parseCommentPayload(await req.json().catch(() => null));
  if (!payload) return reply("bad_request", 400);

  const db = getCounterDb();
  if (!db) return reply("unavailable", 503);

  try {
    const now = Date.now();
    const ip = req.headers.get("cf-connecting-ip");
    // 'comment|' উপসর্গ: view-dedupe hash-এর সাথে সংযোগযোগ্য নয়
    const h = await visitorHash(env.VIEW_HASH_SALT, ip ?? "", req.headers.get("user-agent") ?? "", `comment|${dayKey(now, env.SITE_TIMEZONE)}`);
    const day = dayKey(now, env.SITE_TIMEZONE);
    const hour = new Date(now).toISOString().slice(0, 13);
    const okHour = await consumeLimit(db, commentHourKey(h, hour), day, MAX_COMMENTS_PER_HOUR);
    const okDay = okHour && (await consumeLimit(db, commentDayKey(h, day), day, MAX_COMMENTS_PER_DAY));
    if (!okHour || !okDay) return reply("rate_limited", 429);

    if (!(await verifyTurnstile({ secret: env.TURNSTILE_SECRET_KEY, token: payload.turnstileToken, ip }))) return reply("captcha_failed", 403);

    const budget = createBudget();
    const admin = createAdminDb({
      projectId: env.FIREBASE_PROJECT_ID,
      budget,
      getToken: createTokenProvider({ serviceAccount: parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT), onRequest: () => budget.spend() }),
    });
    const r = await submitComment(admin, payload, env.OWNER_UID, now);
    if (r.kind === "closed") return reply("comments_closed", 404);
    if (r.kind === "bad_parent") return reply("bad_parent", 422);
    if (!r.duplicate) await afterCreate(db, env, payload.authorName, payload.content, r.spam, now);
    return reply(null, r.duplicate ? 200 : 201, { id: r.id });
  } catch (e) {
    log.error("comment submit failed", { detail: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
    return reply("unavailable", 503);
  }
}

/**
 * সফল নতুন মন্তব্যের পর (সব best-effort — ব্যর্থতা মন্তব্যকে আটকায় না, শুধু লগ):
 * ১) approved হলে 'rebuild বাকি' চিহ্ন (Cron ≤১৫ মিনিটে একবারই dispatch করে ⇒ spam-এ Actions-মিনিট পোড়ে না);
 * ২) ইমেইল-খবর (RESEND_API_KEY + NOTIFY_EMAIL থাকলে; spam-এ নয়)
 */
async function afterCreate(
  db: NonNullable<ReturnType<typeof getCounterDb>>,
  env: ReturnType<typeof getCommentEnv>,
  name: string,
  content: string,
  spam: boolean,
  now: number,
) {
  if (spam) return;
  try {
    await markRebuildDirty(db, REBUILD_DIRTY_KEY, dayKey(now, env.SITE_TIMEZONE));
  } catch (e) {
    log.warn("comment dirty-mark failed", { detail: (e instanceof Error ? e.message : String(e)).slice(0, 120) });
  }
  if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
    const ok = await sendNotice({
      apiKey: env.RESEND_API_KEY,
      to: env.NOTIFY_EMAIL,
      subject: `নতুন মন্তব্য — ${name.slice(0, 60)}`,
      text: `${name}:\n\n${content.slice(0, 600)}\n\n${env.SITE_URL}/dashboard/comments`,
    });
    if (!ok) log.warn("comment notice failed", {});
  }
}
