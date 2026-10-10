"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PostWithId } from "@/data/postRepo";
import { getPostRepo } from "@/data/postRepo.wire";
import { bn } from "@/i18n/bn";
import { dayKey } from "@/lib/datetime";
import { byNewest, monthGrid, monthOf, monthRange, shiftMonth } from "@/lib/diary";
import { useAdd } from "../AddSheet";
import { OnThisDay } from "../OnThisDay";
import { useSiteTimezone } from "../SiteSettingsProvider";

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
const ymLabel = (ym: string) => `${bn.diary.months[Number(ym.slice(5, 7)) - 1]} ${bnNum(Number(ym.slice(0, 4)))}`;
// 'YYYY-MM-DD' → "১০ অক্টোবর ২০২৬" (timezone-গণিত ছাড়া, তাই দিন সরে না)
const dayLabel = (k: string) => `${bnNum(Number(k.slice(8, 10)))} ${ymLabel(k.slice(0, 7))}`;

type Load = { ym: string; list: PostWithId[] | null }; // list=null ⇒ ব্যর্থ

/** দিনলিপি: মাসের Calendar (এন্ট্রি-আছে এমন দিনে ●) + নির্বাচিত দিনের এন্ট্রি + 'এই দিনে' (P8a-১) */
export function DiaryView() {
  const tz = useSiteTimezone();
  const { openDiary, diaryVersion } = useAdd();
  const [now] = useState(() => Date.now()); // render-এ impure call নয়; পেজ-খোলার মুহূর্তের 'আজ'
  const today = dayKey(now, tz);
  const [ym, setYm] = useState(monthOf(today));
  const [sel, setSel] = useState(today);
  const [load, setLoad] = useState<Load | undefined>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let dead = false;
    const [from, to] = monthRange(ym);
    getPostRepo()
      .then((r) => r.listDiary({ from, to }))
      .then((list) => {
        if (!dead) setLoad({ ym, list });
      })
      .catch(() => {
        if (!dead) setLoad({ ym, list: null });
      });
    return () => {
      dead = true;
    };
  }, [ym, diaryVersion, attempt]);

  const ready = load?.ym === ym ? load : undefined; // মাস বদলের মুহূর্তে পুরনো মাসের ডেটা নয়
  const byDay = useMemo(() => {
    const m = new Map<string, PostWithId[]>();
    for (const p of ready?.list ?? []) if (p.date) m.set(p.date, [...(m.get(p.date) ?? []), p]);
    return m;
  }, [ready]);
  const grid = useMemo(() => monthGrid(ym), [ym]);
  const entries = (byDay.get(sel) ?? []).slice().sort(byNewest);
  const move = (d: number) => {
    const n = shiftMonth(ym, d);
    setYm(n);
    setSel(n === monthOf(today) ? today : `${n}-01`);
  };
  const nav = "flex size-11 items-center justify-center rounded-full border border-line text-lg";

  return (
    <div className="space-y-4">
      <section aria-label={ymLabel(ym)} className="rounded-2xl border border-line bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label={bn.diary.prevMonth} onClick={() => move(-1)} className={nav}>
            ‹
          </button>
          <h2 className="font-serif text-lg font-bold" aria-live="polite">
            {ymLabel(ym)}
          </h2>
          <button type="button" aria-label={bn.diary.nextMonth} onClick={() => move(1)} className={nav}>
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-muted">
          {bn.diary.weekdays.map((w) => (
            <span key={w} className="py-1">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {grid.flat().map((c, i) =>
            c === null ? (
              <span key={`e${i}`} />
            ) : (
              <button
                key={c.key}
                type="button"
                aria-pressed={c.key === sel}
                aria-label={`${dayLabel(c.key)}${byDay.has(c.key) ? ` — ${bn.diary.hasEntry}` : ""}`}
                onClick={() => setSel(c.key)}
                className={`relative mx-auto flex size-11 items-center justify-center rounded-full text-sm ${
                  c.key === sel ? "bg-btn-bg text-btn-tx" : c.key === today ? "border border-accent-text" : "hover:bg-line"
                }`}
              >
                {bnNum(c.day)}
                {byDay.has(c.key) && (
                  <span aria-hidden className={`absolute bottom-1 size-1.5 rounded-full ${c.key === sel ? "bg-btn-tx" : "bg-accent-text"}`} />
                )}
              </button>
            ),
          )}
        </div>
      </section>

      <section aria-label={dayLabel(sel)}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-bold">{dayLabel(sel)}</h2>
          <button type="button" onClick={openDiary} className="min-h-11 rounded-full bg-btn-bg px-4 text-sm text-btn-tx">
            {bn.diary.addToday}
          </button>
        </div>
        {!ready ? (
          <p role="status" className="text-sm text-muted">
            {bn.diary.loading}
          </p>
        ) : ready.list === null ? (
          <p role="alert" className="text-sm text-accent-text">
            {bn.diary.loadFailed}{" "}
            <button type="button" onClick={() => setAttempt((a) => a + 1)} className="min-h-11 underline">
              {bn.diary.retry}
            </button>
          </p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted">{bn.diary.noEntries}</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {entries.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/posts/${p.id}/edit`} className="block min-h-12 px-4 py-3">
                  <span className="line-clamp-3 block whitespace-pre-line font-serif text-base">{p.excerpt || p.title || bn.diary.untitled}</span>
                  <span className="text-sm text-muted">
                    {bn.diary.words(p.wordCount)}
                    {p.status === "draft" ? ` · ${bn.library.draft}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <OnThisDay />
    </div>
  );
}
