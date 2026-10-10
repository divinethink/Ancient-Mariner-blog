"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PostWithId } from "@/data/postRepo";
import { getPostRepo } from "@/data/postRepo.wire";
import { bn } from "@/i18n/bn";
import { dayKey } from "@/lib/datetime";
import { byNewest, onThisDayKeys } from "@/lib/diary";
import { useAdd } from "./AddSheet";
import { useSiteTimezone } from "./SiteSettingsProvider";

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });

/** 'এই দিনে' (P8a-১): আগের ১–৫ বছরের একই MM-DD-র diary; না থাকলে/আনা না গেলে কার্ড লুকানো (লাইব্রেরি অক্ষত) */
export function OnThisDay() {
  const tz = useSiteTimezone();
  const { diaryVersion } = useAdd();
  const [items, setItems] = useState<PostWithId[]>([]);
  const [now] = useState(() => Date.now()); // render-এ impure call নয়; পেজ-খোলার মুহূর্তের 'আজ'
  const today = dayKey(now, tz);
  useEffect(() => {
    let dead = false;
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
  if (items.length === 0) return null;
  const year = Number(today.slice(0, 4));
  return (
    <section aria-label={bn.diary.onThisDay} className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 text-sm text-muted">📔 {bn.diary.onThisDay}</h2>
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
    </section>
  );
}
