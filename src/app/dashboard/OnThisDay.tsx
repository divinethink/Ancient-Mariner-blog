"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PostWithId } from "@/data/postRepo";
import { getPostRepo } from "@/data/postRepo.wire";
import { bn } from "@/i18n/bn";
import { dayKey } from "@/lib/datetime";
import { byNewest, onThisDayKeys } from "@/lib/diary";
import { useAdd } from "./AddSheet";
import { useSiteTimezone } from "./SiteSettingsProvider";

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
const FLIP_RANGE = { from: "0000-01-01", to: "9999-12-31" } as const;
const dayLabel = (k: string) => `${bnNum(Number(k.slice(8, 10)))} ${bn.diary.months[Number(k.slice(5, 7)) - 1]} ${bnNum(Number(k.slice(0, 4)))}`;

type Flip = { state: "idle" | "loading" | "none" | "failed" } | { state: "shown"; post: PostWithId };

/**
 * 'এই দিনে' (P8a-১): আগের ১–৫ বছরের একই MM-DD-র diary।
 * `always` (শুধু দিনলিপি-পাতা): মিল না থাকলেও কার্ড থাকে (বার্তা + 'পুরনো পাতা উল্টান'); লাইব্রেরি-হোমে (`always` নেই) না থাকলে/আনা না গেলে লুকানো (অক্ষত)।
 */
export function OnThisDay({ always = false }: { always?: boolean }) {
  const tz = useSiteTimezone();
  const { diaryVersion } = useAdd();
  const [items, setItems] = useState<PostWithId[] | undefined>();
  const [flip, setFlip] = useState<Flip>({ state: "idle" });
  const loadingRef = useRef(false);
  const lastId = useRef("");
  const pool = useRef<PostWithId[] | undefined>(undefined); // 'উল্টান'-এর তালিকা: একবার পড়ে ঘুরিয়ে দেখানো (বারবার read নয়)
  const [now] = useState(() => Date.now()); // render-এ impure call নয়; পেজ-খোলার মুহূর্তের 'আজ'
  const today = dayKey(now, tz);
  useEffect(() => {
    let dead = false;
    pool.current = undefined; // নতুন এন্ট্রি সেভ হলে তালিকা বাসি
    getPostRepo()
      .then((r) => r.listDiaryOn(onThisDayKeys(today)))
      .then((l) => {
        if (!dead) setItems(l.filter((p) => p.date).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || byNewest(a, b)));
      })
      .catch(() => {
        if (!dead) setItems([]);
      });
    return () => {
      dead = true;
    };
  }, [today, diaryVersion]);

  const doFlip = useCallback(async () => {
    if (loadingRef.current) return; // double-tap গার্ড
    loadingRef.current = true;
    setFlip((f) => (f.state === "shown" ? f : { state: "loading" }));
    try {
      if (!pool.current) {
        const all = await (await getPostRepo()).listDiary(FLIP_RANGE);
        pool.current = all.filter((p) => p.date);
      }
      const list = pool.current;
      if (list.length === 0) {
        setFlip({ state: "none" });
        return;
      }
      const others = list.length > 1 ? list.filter((p) => p.id !== lastId.current) : list; // পরপর একই পাতা নয়
      const post = others[Math.floor(Math.random() * others.length)]!;
      lastId.current = post.id;
      setFlip({ state: "shown", post });
    } catch {
      setFlip({ state: "failed" });
    } finally {
      loadingRef.current = false;
    }
  }, []);

  if (items === undefined) return null; // আনা চলছে: লাফ এড়াতে কিছু আঁকে না
  if (items.length === 0 && !always) return null;
  const year = Number(today.slice(0, 4));
  return (
    <section aria-label={bn.diary.onThisDay} className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 text-sm text-muted">📔 {bn.diary.onThisDay}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{bn.diary.onThisDayEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.id}>
              <Link href={`/dashboard/posts/${p.id}/edit`} className="block min-h-11">
                <span className="text-sm text-muted">{bn.diary.onThisDayYearsAgo(bnNum(year - Number((p.date ?? "").slice(0, 4))))}</span>
                <span className="line-clamp-3 block whitespace-pre-line font-serif text-base">{p.excerpt || p.title || bn.diary.untitled}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {always && (
        <div className="mt-3 border-t border-line pt-3">
          <button type="button" onClick={() => void doFlip()} aria-disabled={flip.state === "loading"} className="min-h-11 rounded-full border border-line px-4 text-sm aria-disabled:opacity-50">
            {flip.state === "shown" ? bn.diary.flipAnother : bn.diary.flip}
          </button>
          <div role="status" aria-live="polite">
            {flip.state === "none" && <p className="mt-2 text-sm text-muted">{bn.diary.flipNone}</p>}
            {flip.state === "failed" && <p className="mt-2 text-sm text-accent-text">{bn.diary.flipFailed}</p>}
            {flip.state === "shown" && (
              <Link href={`/dashboard/posts/${flip.post.id}/edit`} className="mt-2 block min-h-11">
                <span className="text-sm text-muted">{dayLabel(flip.post.date ?? "")}</span>
                <span className="line-clamp-4 block whitespace-pre-line font-serif text-base">{flip.post.excerpt || flip.post.title || bn.diary.untitled}</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
