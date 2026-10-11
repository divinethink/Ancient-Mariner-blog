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

type DayCellProps = { day: number; k: string; selected: boolean; isToday: boolean; dayEntries: PostWithId[] | undefined; onPick: (k: string) => void };

/** পঞ্জিকার একটি দিন: আজ = পটভূমি; নির্বাচিত = ভরাট বাটন (আজও হলে + ring); ডট ভরাট = প্রকাশিত, ফাঁপা = শুধু খসড়া */
function DayCell({ day, k, selected, isToday, dayEntries, onPick }: DayCellProps) {
  const has = !!dayEntries?.length;
  const published = !!dayEntries?.some((p) => p.status === "published");
  const state = published ? bn.diary.statusPublished : bn.diary.statusDraft;
  const tone = selected ? "bg-btn-bg text-btn-tx" : isToday ? "bg-line font-semibold" : "hover:bg-line";
  const ring = selected && isToday ? "ring-2 ring-accent-text ring-offset-2 ring-offset-surface" : "";
  const dot = selected ? "border-btn-tx" : "border-accent-text";
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-current={isToday ? "date" : undefined}
      aria-label={`${dayLabel(k)}${has ? ` — ${bn.diary.hasEntry} (${state})` : ""}`}
      onClick={() => onPick(k)}
      className={`relative mx-auto flex size-11 items-center justify-center rounded-full text-sm ${tone} ${ring}`}
    >
      {bnNum(day)}
      {has && <span aria-hidden className={`absolute bottom-1 size-2 rounded-full border-[1.5px] ${dot} ${published ? (selected ? "bg-btn-tx" : "bg-accent-text") : ""}`} />}
    </button>
  );
}

/** এন্ট্রি-কার্ড তালিকা: ≤৮ লাইন প্রিভিউ; excerpt কাটা ("…") হলে 'আরও পড়ুন →'; খসড়া-ব্যাজ */
function EntryList({ items }: { items: PostWithId[] }) {
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {items.map((p) => {
        const text = p.excerpt || p.title || bn.diary.untitled;
        return (
          <li key={p.id}>
            <Link href={`/dashboard/posts/${p.id}/edit`} className="block min-h-12 px-4 py-3">
              <span className="line-clamp-8 block whitespace-pre-line font-serif text-base">{text}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                <span className="whitespace-nowrap">{bn.diary.words(bnNum(p.wordCount))}</span>
                {p.status !== "published" && <span className="rounded-full border border-line px-2 text-xs">{bn.library.draft}</span>}
                {text.endsWith("…") && <span className="ms-auto font-semibold text-accent-text">{bn.diary.readMore}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

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
  // সর্বশেষ দিনলিপি: আজ ফাঁকা হলে এই মাসের (লোড-হওয়া) সবচেয়ে নতুন দিনের এন্ট্রি
  const latest = useMemo(() => {
    if (sel !== today || entries.length > 0) return [];
    const days = [...byDay.keys()].sort();
    const d = days[days.length - 1];
    return d ? (byDay.get(d) ?? []).slice().sort(byNewest) : [];
  }, [byDay, sel, today, entries.length]);
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
              <DayCell key={c.key} day={c.day} k={c.key} selected={c.key === sel} isToday={c.key === today} dayEntries={byDay.get(c.key)} onPick={setSel} />
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
          <>
            <p className="text-sm text-muted">{bn.diary.noEntries}</p>
            {latest.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold text-muted">
                  {bn.diary.latest} · {dayLabel(latest[0]!.date ?? sel)}
                </h3>
                <EntryList items={latest} />
              </div>
            )}
          </>
        ) : (
          <EntryList items={entries} />
        )}
      </section>

      <OnThisDay />
    </div>
  );
}
