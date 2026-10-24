"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { convertIdeaToPost } from "@/data/ideaConvert";
import type { IdeaWithId } from "@/data/ideaRepo";
import { getIdeaRepo } from "@/data/ideaRepo.wire";
import { getLetterRepo } from "@/data/letterRepo.wire";
import type { SpecialDayWithId } from "@/data/specialDayRepo";
import { getSpecialDayRepo } from "@/data/specialDayRepo.wire";
import { goalStore } from "@/data/goalStore";
import { localStore } from "@/data/localStore";
import type { PostWithId } from "@/data/postRepo";
import { listStaleDrafts } from "@/data/staleDraftRepo.client";
import { getPostRepo } from "@/data/postRepo.wire";
import { bn } from "@/i18n/bn";
import { dayKey } from "@/lib/datetime";
import { DEFAULT_GOAL, goalPercent, pickRandom } from "@/lib/goal";
import { dailyTaskFor } from "@/lib/dailyTask";
import { sortUpcoming, yearsAt } from "@/lib/specialDays";
import { daysSince, isSnoozed, pickStaleDraft } from "@/lib/staleDrafts";
import { OnThisDay } from "./OnThisDay";
import { useSiteTimezone } from "./SiteSettingsProvider";
import { useHomeCards } from "./useHomeCards";

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });

/** রিজিউম + দৈনিক লক্ষ্য এক কার্ডে (ধাপ ২): `▶ চালিয়ে যান` শিরোনাম + পাতলা প্রগ্রেস-বার। লক্ষ্য-পছন্দ বন্ধ থাকলে শুধু রিজিউম */
export function ResumeGoalCard({ latest }: { latest: { id: string; title: string } | null }) {
  const tz = useSiteTimezone();
  const prefs = useHomeCards(); // SSR/hydration মিল: mount-এর পর পছন্দ আসে
  const [words, setWords] = useState(0);
  useEffect(() => {
    let dead = false;
    goalStore
      .wordsToday(dayKey(Date.now(), tz))
      .then((n) => {
        if (!dead) setWords(n);
      })
      .catch(() => undefined); // লক্ষ্য না পেলে ০ দেখায়, লাইব্রেরি অক্ষত
    return () => {
      dead = true;
    };
  }, [tz]);
  const showGoal = !!prefs?.goal;
  const pct = goalPercent(words, DEFAULT_GOAL);
  const stat = showGoal ? (
    <span className="shrink-0 text-xs opacity-90">
      {bn.home.goalWords(words, DEFAULT_GOAL)} · <span aria-hidden>{bnNum(pct)}%</span>
    </span>
  ) : null;
  const bar = showGoal ? (
    <span
      role="progressbar"
      aria-label={bn.home.goalTitle}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="mt-1.5 block h-1 overflow-hidden rounded-full"
      style={{ background: "color-mix(in srgb, currentColor 25%, transparent)" }}
    >
      <span className="block h-full rounded-full bg-current" style={{ width: `${pct}%` }} />
    </span>
  ) : null;
  if (!latest)
    return showGoal ? (
      <div className="rounded-2xl border border-line bg-surface px-4 py-3">
        <span className="flex text-sm">{stat}</span>
        {bar}
      </div>
    ) : null;
  return (
    <Link href={`/dashboard/posts/${latest.id}/edit`} className="block rounded-2xl bg-btn-bg px-4 py-3 text-btn-tx">
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs opacity-90">▶ {bn.library.resume}</span>
        {stat}
      </span>
      <span className="block truncate font-serif text-lg font-bold leading-snug">{latest.title || bn.library.untitled}</span>
      {bar}
    </Link>
  );
}

/** হোমের ওপরের দুই কার্ড: চালিয়ে যান (+লক্ষ্য), তার নিচে 'আজকের একটি কাজ' (চালু থাকলে) — কম উচ্চতা */
export function HomeTopRow({ latest }: { latest: { id: string; title: string } | null }) {
  const prefs = useHomeCards();
  const daily = !!prefs?.daily;
  const hasResume = !!latest || !!prefs?.goal;
  if (!hasResume && !daily) return null;
  return (
    <div className="mb-4 space-y-2">
      {hasResume && <ResumeGoalCard latest={latest} />}
      {daily && <DailyTask />}
    </div>
  );
}

/** লাইব্রেরি হোমের শান্ত কার্ড: আইডিয়া-বাছাই ও এই-দিনে (Mockup §৭.৬, P7a); প্রতিটা Settings-এ বন্ধ করা যায় */
export function HomeCards() {
  const prefs = useHomeCards();
  if (!prefs) return null;
  return (
    <div className="mb-4 space-y-3">
      <LetterReady />
      <UpcomingDays />
      {prefs.pick && <StaleDraft />}
      {prefs.pick && <IdeaPick />}
      <OnThisDay />
    </div>
  );
}

/** খোলার সময় হয়েছে অথচ পড়া হয়নি এমন চিঠি থাকলে একটা শান্ত কার্ড; না থাকলে/আনা না গেলে কিছুই আঁকে না */
function LetterReady() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let dead = false;
    getLetterRepo()
      .then((r) => r.listReady(Date.now()))
      .then((l) => {
        if (!dead) setN(l.length);
      })
      .catch(() => undefined);
    return () => {
      dead = true;
    };
  }, []);
  if (n === 0) return null;
  return (
    <Link href="/dashboard/letters" className="flex min-h-11 items-center rounded-2xl border border-line bg-surface p-4">
      📬 {bn.letters.ready(bnNum(n))}
    </Link>
  );
}

/** পরের ১৪ দিনে বিশেষ দিন (জন্মদিন/বার্ষিকী) থাকলে একটা কার্ড; না থাকলে/আনা না গেলে কিছুই আঁকে না */
function UpcomingDays() {
  const tz = useSiteTimezone();
  const [today] = useState(() => dayKey(Date.now(), tz));
  const [items, setItems] = useState<SpecialDayWithId[]>([]);
  useEffect(() => {
    let dead = false;
    getSpecialDayRepo()
      .then((r) => r.list())
      .then((l) => {
        if (!dead) setItems(l);
      })
      .catch(() => undefined);
    return () => {
      dead = true;
    };
  }, []);
  const soon = sortUpcoming(items, today, 14).slice(0, 3);
  if (soon.length === 0) return null;
  return (
    <section aria-label={bn.days.upcoming} className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 text-sm text-muted">🎂 {bn.days.upcoming}</h2>
      <ul className="space-y-1">
        {soon.map((d) => {
          const n = yearsAt(d.next, d.year);
          return (
            <li key={d.id} className="font-serif text-base">
              {d.name}
              {n !== undefined && <span className="text-sm text-muted"> · {bn.days.years(bnNum(n))}</span>} — {d.inDays === 0 ? bn.days.today : bn.days.inDays(bnNum(d.inDays))}
            </li>
          );
        })}
      </ul>
      <Link href="/dashboard/days" className="mt-1 inline-flex min-h-11 items-center text-accent-text underline">
        {bn.days.upcomingAll}
      </Link>
    </section>
  );
}

/** 'আজকের একটি কাজ': দিন-অনুযায়ী একটাই ছোট সুপারিশ (ডিফল্ট বন্ধ; Settings-এ চালু)। গোনা/streak/অপরাধবোধ নেই */
function DailyTask() {
  const tz = useSiteTimezone();
  const [today] = useState(() => dayKey(Date.now(), tz));
  const t = dailyTaskFor(today);
  return (
    <Link
      href={t.href}
      aria-label={`${bn.home.dailyTitle}: ${bn.home.dailyTasks[t.id]}`}
      className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4 py-2"
    >
      <span className="min-w-0 truncate">
        <span aria-hidden>🎯 </span>
        <span className="font-serif text-base">{bn.home.dailyTasks[t.id]}</span>
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}

const SNOOZE_KEY = "staleDraft:snoozedAt";

/** ৩০ দিনের বেশি পুরনো নিজের অসমাপ্ত খসড়ার একটা শান্ত মনে-করানো; [এখন নয়] ৭ দিন লুকায় (প্রতি-ডিভাইস)। না থাকলে/আনা না গেলে (index তৈরি হয়নি) কিছুই আঁকে না */
function StaleDraft() {
  const [draft, setDraft] = useState<PostWithId | null>(null);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    let dead = false;
    localStore
      .get<number>(SNOOZE_KEY)
      .then(async (snoozedAt) => {
        if (isSnoozed(snoozedAt, now)) return;
        const found = pickStaleDraft(await listStaleDrafts(now), now);
        if (!dead) setDraft(found ?? null);
      })
      .catch(() => undefined);
    return () => {
      dead = true;
    };
  }, [now]);
  if (!draft) return null;
  return (
    <section aria-label={bn.home.staleTitle} className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-1 text-sm text-muted">🕰️ {bn.home.staleTitle}</h2>
      <p className="truncate font-serif text-lg font-bold">{draft.title || bn.library.untitled}</p>
      <p className="text-sm text-muted">{bn.home.staleAge(bnNum(daysSince(draft.updatedAt, now)))}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link href={`/dashboard/posts/${draft.id}/edit`} className="inline-flex min-h-11 items-center rounded-full bg-btn-bg px-4 text-sm text-btn-tx">
          {bn.home.staleFinish}
        </Link>
        <button
          type="button"
          onClick={() => {
            void localStore.set(SNOOZE_KEY, Date.now()).catch(() => undefined);
            setDraft(null);
          }}
          className="min-h-11 rounded-full border border-line px-4 text-sm"
        >
          {bn.home.staleLater}
        </button>
      </div>
    </section>
  );
}

function IdeaPick() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<IdeaWithId[] | null>(null);
  const [cur, setCur] = useState<IdeaWithId | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let dead = false;
    getIdeaRepo()
      .then((r) => r.list({ limit: 100 }))
      .then((l) => {
        if (dead) return;
        const open = l.filter((i) => !i.convertedToPostId);
        setIdeas(open);
        setCur(pickRandom(open));
      })
      .catch(() => {
        if (!dead) setIdeas([]); // আনা না গেলে কার্ড লুকানো থাকে, লাইব্রেরি অক্ষত
      });
    return () => {
      dead = true;
    };
  }, []);
  if (!ideas || ideas.length === 0 || !cur) return null;

  async function write() {
    if (busy || !cur) return;
    setBusy(true);
    setErr(false);
    try {
      const [ir, pr] = await Promise.all([getIdeaRepo(), getPostRepo()]);
      const r = await convertIdeaToPost(ir, pr, cur.id); // idempotent (post-id = idea-id)
      router.push(`/dashboard/posts/${r.postId}/edit`);
    } catch {
      setErr(true);
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="mb-1 text-sm text-muted">🎲 {bn.home.pickTitle}</p>
      <p className="mb-3 line-clamp-3 whitespace-pre-line font-serif text-lg">{cur.title || cur.text}</p>
      {err && (
        <p role="alert" className="mb-2 text-sm text-accent-text">
          {bn.home.pickFailed}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void write()}
          className="min-h-11 rounded-full bg-btn-bg px-4 text-sm text-btn-tx disabled:opacity-50"
        >
          {bn.home.pickWrite}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setCur(pickRandom(ideas, cur.id))}
          className="min-h-11 rounded-full border border-line px-4 text-sm disabled:opacity-50"
        >
          {bn.home.pickAnother}
        </button>
      </div>
    </div>
  );
}
