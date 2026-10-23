"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { convertIdeaToPost } from "@/data/ideaConvert";
import type { IdeaWithId } from "@/data/ideaRepo";
import { getIdeaRepo } from "@/data/ideaRepo.wire";
import { getLetterRepo } from "@/data/letterRepo.wire";
import { goalStore } from "@/data/goalStore";
import { localStore } from "@/data/localStore";
import type { PostWithId } from "@/data/postRepo";
import { listStaleDrafts } from "@/data/staleDraftRepo.client";
import { getPostRepo } from "@/data/postRepo.wire";
import { bn } from "@/i18n/bn";
import { dayKey } from "@/lib/datetime";
import { DEFAULT_GOAL, goalPercent, pickRandom } from "@/lib/goal";
import { newId } from "@/lib/id";
import { ideaToPostSeed } from "@/lib/idea";
import { daysSince, isSnoozed, pickStaleDraft } from "@/lib/staleDrafts";
import { PROMPT_TYPES, writingPromptFor, type PromptType } from "@/lib/writingPrompts";
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
  const goal = showGoal ? (
    <span className="mt-2 block">
      <span className="flex items-center justify-between gap-2 text-sm">
        <span>{bn.home.goalWords(words, DEFAULT_GOAL)}</span>
        <span aria-hidden>{bnNum(pct)}%</span>
      </span>
      <span
        role="progressbar"
        aria-label={bn.home.goalTitle}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-1 block h-1.5 overflow-hidden rounded-full"
        style={{ background: "color-mix(in srgb, currentColor 25%, transparent)" }}
      >
        <span className="block h-full rounded-full bg-current" style={{ width: `${pct}%` }} />
      </span>
    </span>
  ) : null;
  if (!latest) return goal ? <div className="mb-4 rounded-2xl border border-line bg-surface p-4">{goal}</div> : null;
  return (
    <Link href={`/dashboard/posts/${latest.id}/edit`} className="mb-4 block rounded-2xl bg-btn-bg p-4 text-btn-tx">
      <span className="text-sm opacity-90">▶ {bn.library.resume}</span>
      <span className="block truncate font-serif text-lg font-bold">{latest.title || bn.library.untitled}</span>
      {goal}
    </Link>
  );
}

/** লাইব্রেরি হোমের শান্ত কার্ড: আইডিয়া-বাছাই ও এই-দিনে (Mockup §৭.৬, P7a); প্রতিটা Settings-এ বন্ধ করা যায় */
export function HomeCards() {
  const prefs = useHomeCards();
  if (!prefs) return null;
  return (
    <div className="mb-4 space-y-3">
      <LetterReady />
      {prefs.pick && <StaleDraft />}
      {prefs.pick && <IdeaPick />}
      {prefs.pick && <PromptCard />}
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

/** ধরন বেছে হালকা প্রম্পট; [এটা নিয়ে লিখুন] = ঐ ধরনের নতুন খসড়া (প্রম্পট প্রথম অনুচ্ছেদে) */
function PromptCard() {
  const router = useRouter();
  const tz = useSiteTimezone();
  const [today] = useState(() => dayKey(Date.now(), tz));
  const [type, setType] = useState<PromptType>("story");
  const [shift, setShift] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const idRef = useRef("");
  const prompt = writingPromptFor(type, today, shift);

  async function write() {
    if (busy) return;
    if (!idRef.current) idRef.current = newId(); // ব্যর্থ হলে একই id-তে retry ⇒ duplicate খসড়া হয় না
    setBusy(true);
    setErr(false);
    try {
      const seed = ideaToPostSeed({ text: prompt });
      const post = await (await getPostRepo()).create({ id: idRef.current, title: "", body: seed.body, excerpt: seed.excerpt, wordCount: seed.wordCount, contentType: type });
      router.push(`/dashboard/posts/${post.id}/edit`);
    } catch {
      setErr(true);
      setBusy(false);
    }
  }

  return (
    <section aria-label={bn.home.promptTitle} className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 text-sm text-muted">✍️ {bn.home.promptTitle}</h2>
      <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label={bn.home.promptTitle}>
        {PROMPT_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            onClick={() => {
              setType(t);
              setShift(0);
            }}
            className={`min-h-11 rounded-full px-4 text-sm ${type === t ? "bg-btn-bg text-btn-tx" : "border border-line"}`}
          >
            {bn.home.promptTypes[t]}
          </button>
        ))}
      </div>
      <p className="font-serif text-lg">{prompt}</p>
      {err && <p role="alert" className="mt-2 text-accent-text">{bn.home.promptFailed}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => void write()} aria-disabled={busy} className="min-h-11 rounded-full bg-btn-bg px-4 text-sm text-btn-tx aria-disabled:opacity-60">
          {bn.home.promptWrite}
        </button>
        <button type="button" onClick={() => setShift((n) => n + 1)} className="min-h-11 rounded-full border border-line px-4 text-sm">
          {bn.home.promptAnother}
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
