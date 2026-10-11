"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { convertIdeaToPost } from "@/data/ideaConvert";
import type { IdeaWithId } from "@/data/ideaRepo";
import { getIdeaRepo } from "@/data/ideaRepo.wire";
import { goalStore } from "@/data/goalStore";
import { getPostRepo } from "@/data/postRepo.wire";
import { bn } from "@/i18n/bn";
import { dayKey } from "@/lib/datetime";
import { DEFAULT_GOAL, goalPercent, pickRandom } from "@/lib/goal";
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
      {prefs.pick && <IdeaPick />}
      <OnThisDay />
    </div>
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
