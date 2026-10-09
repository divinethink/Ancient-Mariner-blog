"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readHomeCard } from "@/data/comfortStore";
import { convertIdeaToPost } from "@/data/ideaConvert";
import type { IdeaWithId } from "@/data/ideaRepo";
import { getIdeaRepo } from "@/data/ideaRepo.wire";
import { goalStore } from "@/data/goalStore";
import { getPostRepo } from "@/data/postRepo.wire";
import { bn } from "@/i18n/bn";
import { dayKey } from "@/lib/datetime";
import { DEFAULT_GOAL, goalPercent, pickRandom } from "@/lib/goal";
import { useSiteTimezone } from "./SiteSettingsProvider";

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });

/** লাইব্রেরি হোমের তিনটি শান্ত কার্ড (Mockup §৭.৬, P7a)। প্রতিটা Settings-এ বন্ধ করা যায় (প্রতি-ডিভাইস) */
export function HomeCards({ published, drafts }: { published: number; drafts: number }) {
  const tz = useSiteTimezone();
  // SSR/hydration মিল: পছন্দ mount-এর পর পড়ি
  const [prefs, setPrefs] = useState<{ goal: boolean; glance: boolean; pick: boolean } | null>(null);
  const [words, setWords] = useState(0);
  useEffect(() => {
    setPrefs({ goal: readHomeCard("goal"), glance: readHomeCard("glance"), pick: readHomeCard("pick") });
  }, []);
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
  if (!prefs) return null;
  const pct = goalPercent(words, DEFAULT_GOAL);
  return (
    <div className="mb-5 space-y-3">
      {prefs.goal && (
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
          <div
            role="img"
            aria-label={bn.home.goalWords(words, DEFAULT_GOAL)}
            className="relative grid size-14 shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(var(--accent) ${pct}%, var(--line) 0)` }}
          >
            <span className="absolute inset-1.5 rounded-full bg-surface" aria-hidden />
            <span className="relative text-sm font-semibold" aria-hidden>
              {bnNum(pct)}%
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{bn.home.goalWords(words, DEFAULT_GOAL)}</p>
            <p className="text-sm text-muted">{bn.home.goalHint}</p>
          </div>
        </div>
      )}
      {prefs.glance && (
        <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
          📊 {bn.home.glance(published, drafts)}
        </p>
      )}
      {prefs.pick && <IdeaPick />}
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
