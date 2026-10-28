"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PostWithId } from "@/data/postRepo";
import { getPostRepo } from "@/data/postRepo.wire";
import { localStore } from "@/data/localStore";
import { bn } from "@/i18n/bn";
import { dayKey, formatDate } from "@/lib/datetime";
import { DiaryPage } from "@/components/diary/DiaryPage";
import { periodOf } from "@/lib/diaryPeriod";
import { Icon } from "@/components/icons";
import { triggerSiteRebuild } from "@/data/rebuildClient";
import { getSiteSettingsRepo } from "@/data/siteSettingsRepo.wire";
import type { DiaryLook } from "@/lib/diaryLook";
import {
  byNewest,
  diaryVisOf,
  diaryVisPatch,
  monthGrid,
  monthOf,
  monthRange,
  shiftMonth,
  type DiaryVis,
} from "@/lib/diary";
import { useAdd } from "../AddSheet";
import { OnThisDay } from "../OnThisDay";
import { useSiteSettings, useSiteTimezone } from "../SiteSettingsProvider";
import { DiaryTiles } from "@/components/diary/DiaryTiles";
import { photoIdsOf } from "@/lib/diaryPhotos";
import { DiaryDownload } from "./DiaryDownload";
import { DiaryThumbs } from "./DiaryThumbs";
import { DiaryLookSheet } from "./DiaryLookSheet";
import { useDiaryLook } from "./useDiaryLook";

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
const ymLabel = (ym: string) =>
  `${bn.diary.months[Number(ym.slice(5, 7)) - 1]} ${bnNum(Number(ym.slice(0, 4)))}`;
// 'YYYY-MM-DD' → "১০ অক্টোবর ২০২৬" (timezone-গণিত ছাড়া, তাই দিন সরে না)
const dayLabel = (k: string) => `${bnNum(Number(k.slice(8, 10)))} ${ymLabel(k.slice(0, 7))}`;

type Load = { ym: string; list: PostWithId[] | null }; // list=null ⇒ ব্যর্থ

type DayCellProps = {
  day: number;
  k: string;
  selected: boolean;
  isToday: boolean;
  dayEntries: PostWithId[] | undefined;
  onPick: (k: string) => void;
};

/** পঞ্জিকার একটি দিন: আজ = --today রঙের গোল-কোণা স্কয়ার (পাবলিক পঞ্জিকার মতো); নির্বাচিত = ভরাট বাটন (আজও হলে + ring); ডট ভরাট = প্রকাশিত (পাবলিক), ফাঁপা = ব্যক্তিগত */
function DayCell({ day, k, selected, isToday, dayEntries, onPick }: DayCellProps) {
  const has = !!dayEntries?.length;
  const published = !!dayEntries?.some((p) => diaryVisOf(p) === "public");
  const state = published ? bn.diary.visPublic : bn.diary.visPrivate;
  const tone = selected
    ? "bg-btn-bg text-btn-tx"
    : isToday
      ? "bg-today text-today-tx font-bold"
      : "hover:bg-line";
  const shape = isToday && !selected ? "rounded-lg" : "rounded-full";
  const ring =
    selected && isToday ? "ring-2 ring-accent-text ring-offset-2 ring-offset-surface" : "";
  const dot = selected ? "border-btn-tx" : "border-accent-text";
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-current={isToday ? "date" : undefined}
      aria-label={`${dayLabel(k)}${has ? ` — ${bn.diary.hasEntry} (${state})` : ""}`}
      onClick={() => onPick(k)}
      className={`relative mx-auto flex size-11 items-center justify-center ${shape} text-sm ${tone} ${ring}`}
    >
      {bnNum(day)}
      {has && (
        <span
          aria-hidden
          className={`absolute bottom-1 size-2 rounded-full border-[1.5px] ${dot} ${published ? (selected ? "bg-btn-tx" : "bg-accent-text") : ""}`}
        />
      )}
    </button>
  );
}

/** এন্ট্রি তালিকা: প্রতিটি ডায়েরির পাতার চেহারায় (≤৮ লাইন প্রিভিউ); excerpt কাটা ("…") হলে 'আরও পড়ুন →'; নিচে ব্যক্তিগত/প্রকাশিত বোতাম (ট্যাপে বদল) */
function EntryList({
  items,
  look,
  tz,
  busyId,
  onToggle,
}: {
  items: PostWithId[];
  look: DiaryLook;
  tz: string;
  busyId: string | null;
  onToggle: (p: PostWithId) => void;
}) {
  return (
    <ul className="space-y-4">
      {items.map((p) => {
        const text = p.excerpt || p.title || bn.diary.untitled;
        const vis: DiaryVis = diaryVisOf(p);
        const day = p.date ?? "";
        const auto = day ? formatDate(new Date(`${day}T12:00:00Z`), "UTC") : "";
        const custom = p.title.trim() !== "" && p.title !== auto;
        const per = periodOf(p.createdAt, tz);
        return (
          <li key={p.id}>
            <div className="relative">
              <DiaryPage
                day={day}
                title={custom ? p.title : undefined}
                location={p.location}
                period={per ? bn.diary.periods[per] : undefined}
                night={per === "night"}
                look={look}
                footer={
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="whitespace-nowrap">{bn.diary.words(bnNum(p.wordCount))}</span>
                    {text.endsWith("…") && (
                      <span className="ms-auto font-semibold">{bn.diary.readMore}</span>
                    )}
                  </span>
                }
              >
                {/* after:inset-0 = পুরো কার্ড ট্যাপযোগ্য (আগে শুধু লেখার লাইন — তাই বারবার ট্যাপ লাগত) */}
                <Link
                  href={`/dashboard/posts/${p.id}/edit`}
                  className="block min-h-12 after:absolute after:inset-0 after:content-['']"
                >
                  <span className="line-clamp-8 block whitespace-pre-line">{text}</span>
                </Link>
                <DiaryThumbs ids={photoIdsOf(p.body)} />
              </DiaryPage>
            </div>
            <div className="flex flex-wrap items-center gap-2 px-1 pt-2">
              <button
                type="button"
                disabled={busyId === p.id}
                aria-label={`${vis === "public" ? bn.diary.visPublic : bn.diary.visPrivate} — ${vis === "public" ? bn.diary.toPrivate : bn.diary.toPublic}`}
                onClick={() => onToggle(p)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm disabled:opacity-50 ${vis === "public" ? "border-btn-bg bg-btn-bg text-btn-tx" : "border-line"}`}
              >
                <Icon name={vis === "public" ? "globe" : "lock"} size={16} />
                {vis === "public" ? bn.diary.visPublic : bn.diary.visPrivate}
              </button>
              <Link
                href={`/dashboard/posts/${p.id}/edit`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3 text-sm"
              >
                {bn.diary.editEntry}
              </Link>
            </div>
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [visErr, setVisErr] = useState(false);
  const { look, site, update: setLook } = useDiaryLook();
  const { settings, setSettings } = useSiteSettings();
  const [dlOpen, setDlOpen] = useState(false);
  const [lookOpen, setLookOpen] = useState(false);
  const [siteBusy, setSiteBusy] = useState(false);
  const [siteMsg, setSiteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /** বর্তমান চেহারা পাবলিক সাইটের ডিফল্ট করা: সর্বশেষ সেটিংস পড়ে শুধু তিনটি ফিল্ড বদলে সেভ (অন্য সেটিং অক্ষত), তারপর rebuild */
  async function saveSiteLook() {
    if (siteBusy || !confirm(bn.diary.look.confirmSite)) return;
    setSiteBusy(true);
    setSiteMsg(null);
    try {
      const repo = await getSiteSettingsRepo();
      const cur = await repo.get();
      const next = await repo.save({
        ...cur,
        diaryTheme: look.theme,
        diaryFont: look.font,
        diarySize: look.size,
      });
      setSettings(next);
      const ok = await triggerSiteRebuild();
      setSiteMsg({ ok, text: ok ? bn.diary.look.siteSaved : bn.diary.look.siteSavedNoRebuild });
    } catch {
      setSiteMsg({ ok: false, text: bn.diary.look.siteFailed });
    } finally {
      setSiteBusy(false);
    }
  }

  /** ব্যক্তিগত ⇄ প্রকাশিত: সংরক্ষণ সফল হলে তালিকা নতুন করে আনে ও সাইট rebuild চায়। private করার আগে থাকা অপ্রকাশিত সম্পাদনা posts-এ কপি (কিছু হারায় না) */
  async function toggleVis(p: PostWithId) {
    if (busyId) return;
    const next: DiaryVis = diaryVisOf(p) === "public" ? "private" : "public";
    if (!confirm(next === "public" ? bn.diary.confirmPublic : bn.diary.confirmPrivate)) return;
    setBusyId(p.id);
    setVisErr(false);
    try {
      const repo = await getPostRepo();
      if (next === "private") await repo.applyDraft(p.id, p.wordCount);
      await repo.update(
        p.id,
        next === "public"
          ? { ...diaryVisPatch(next), diaryTheme: look.theme }
          : diaryVisPatch(next),
      ); // পাবলিক করার সময়ের থিম লেখার সাথে থাকে
      void triggerSiteRebuild();
      setAttempt((a) => a + 1);
    } catch {
      setVisErr(true);
    } finally {
      setBusyId(null);
    }
  }

  // সম্পাদনা-পাতার ভারী Tiptap-কোড দিনলিপি খোলার একটু পরে ব্যাকগ্রাউন্ডে নামানো — 'সম্পাদনা' চাপলে আর অপেক্ষা নয় (ব্যর্থ হলে চুপচাপ; পরে স্বাভাবিক লোড)
  useEffect(() => {
    const t = window.setTimeout(
      () => void import("../posts/[postId]/edit/TiptapEditor").catch(() => undefined),
      1500,
    );
    return () => window.clearTimeout(t);
  }, []);

  // আগে লোকাল কপি (IndexedDB) সঙ্গে সঙ্গে দেখায় — Firestore আসতে ১-৩ সেকেন্ড লাগলেও পাতা ফাঁকা থাকে না; নেটওয়ার্কের ফল এলে বদলে যায়
  useEffect(() => {
    let dead = false;
    let fresh = false;
    let shown = false;
    const [from, to] = monthRange(ym);
    const key = `diarycache:${ym}`;
    localStore
      .get<PostWithId[]>(key)
      .then((c) => {
        if (!dead && !fresh && Array.isArray(c)) {
          shown = true;
          setLoad({ ym, list: c });
        }
      })
      .catch(() => undefined);
    getPostRepo()
      .then((r) => r.listDiary({ from, to }))
      .then((list) => {
        fresh = true;
        if (!dead) setLoad({ ym, list });
        void localStore.set(key, list).catch(() => undefined);
      })
      .catch(() => {
        if (!dead && !shown) setLoad({ ym, list: null });
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
      {ready?.list && (
        <DiaryTiles
          tone="soft"
          items={[
            { n: ready.list.length, label: bn.diary.tiles.month },
            {
              n: ready.list.reduce((n, p) => n + photoIdsOf(p.body).length, 0),
              label: bn.diary.tiles.photos,
            },
            {
              n: ready.list.filter((p) => diaryVisOf(p) === "public").length,
              label: bn.diary.tiles.published,
            },
          ]}
        />
      )}

      <section aria-label={ymLabel(ym)} className="rounded-2xl border border-line bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label={bn.diary.prevMonth}
            onClick={() => move(-1)}
            className={nav}
          >
            ‹
          </button>
          <h2 className="font-serif text-lg font-bold" aria-live="polite">
            {ymLabel(ym)}
          </h2>
          <button
            type="button"
            aria-label={bn.diary.nextMonth}
            onClick={() => move(1)}
            className={nav}
          >
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
          {grid
            .flat()
            .map((c, i) =>
              c === null ? (
                <span key={`e${i}`} />
              ) : (
                <DayCell
                  key={c.key}
                  day={c.day}
                  k={c.key}
                  selected={c.key === sel}
                  isToday={c.key === today}
                  dayEntries={byDay.get(c.key)}
                  onPick={setSel}
                />
              ),
            )}
        </div>
        <p className="mt-2 flex items-center gap-4 px-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-full border-[1.5px] border-accent-text bg-accent-text"
            />
            {bn.diary.legendPublic}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full border-[1.5px] border-accent-text" />
            {bn.diary.legendPrivate}
          </span>
        </p>
      </section>

      <section aria-label={dayLabel(sel)}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-bold">{dayLabel(sel)}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLookOpen(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3 text-sm"
            >
              <Icon name="palette" size={18} />
              {bn.diary.lookButton}
            </button>
            <button
              type="button"
              onClick={() => setDlOpen(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3 text-sm"
            >
              <Icon name="import" size={18} />
              {bn.diary.dl.button}
            </button>
            <button
              type="button"
              onClick={openDiary}
              className="min-h-11 rounded-full bg-btn-bg px-4 text-sm text-btn-tx"
            >
              {bn.diary.addToday}
            </button>
          </div>
        </div>
        {!ready ? (
          <p role="status" className="text-sm text-muted">
            {bn.diary.loading}
          </p>
        ) : ready.list === null ? (
          <p role="alert" className="text-sm text-accent-text">
            {bn.diary.loadFailed}{" "}
            <button
              type="button"
              onClick={() => setAttempt((a) => a + 1)}
              className="min-h-11 underline"
            >
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
                <EntryList
                  items={latest}
                  look={look}
                  tz={tz}
                  busyId={busyId}
                  onToggle={toggleVis}
                />
              </div>
            )}
          </>
        ) : (
          <EntryList items={entries} look={look} tz={tz} busyId={busyId} onToggle={toggleVis} />
        )}
        {visErr && (
          <p role="alert" className="mt-2 text-sm text-accent-text">
            {bn.diary.visFailed}
          </p>
        )}
      </section>

      <OnThisDay always />

      {dlOpen && (
        <DiaryDownload
          look={look}
          sel={sel}
          tz={tz}
          author={settings.siteTitle}
          onClose={() => setDlOpen(false)}
        />
      )}
      {lookOpen && (
        <DiaryLookSheet
          look={look}
          site={site}
          busy={siteBusy}
          msg={siteMsg}
          onChange={setLook}
          onSaveSite={() => void saveSiteLook()}
          onClose={() => setLookOpen(false)}
        />
      )}
    </div>
  );
}
