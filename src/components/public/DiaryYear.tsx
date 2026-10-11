import Link from "next/link";
import { bn } from "@/i18n/bn";
import { diaryYearPath, type StreakStats, type YearView } from "@/lib/diaryCalendar";
import { TodayMark } from "./TodayMark";

const HEAT = ["bg-line/60", "bg-accent/20", "bg-accent/40", "bg-accent/60", "bg-accent/85"] as const;
const CELL = 12; // px; ১২ মাস ≈ ৫৩ সপ্তাহ → মোবাইলে অনুভূমিক স্ক্রল (ছক বোঝার জন্য; নেভিগেশন মূলত মাসের পঞ্জিকায়)
const GAP = 3;

/** বছরের হিটম্যাপ (GitHub-স্টাইল): প্রতি ঘর = একদিন, রং = কত লিখেছি; মাসের নামে ক্লিক → সেই মাসের প্রথম লেখা। আজ আলাদা রঙে (TodayMark) */
export function DiaryYear({ view, years, timeZone }: { view: YearView; years: readonly number[]; timeZone: string }) {
  const cols = view.weeks.length;
  const tpl = `repeat(${cols}, ${CELL}px)`;
  return (
    <section aria-label={bn.public.diaryYearSummary(view.year, view.writtenDays)}>
      <TodayMark timeZone={timeZone} />
      <p className="mb-2 font-semibold">{bn.public.diaryYearSummary(view.year, view.writtenDays)}</p>
      <div className="overflow-x-auto pb-2">
        <div style={{ width: cols * CELL + (cols - 1) * GAP }}>
          <div className="mb-1 grid h-5 text-xs text-muted" style={{ gridTemplateColumns: tpl, columnGap: GAP }}>
            {view.months.map((m) => (
              <span key={m.label + m.col} style={{ gridColumnStart: m.col + 1 }} className="whitespace-nowrap">
                {m.href ? (
                  <Link href={m.href} prefetch={false} className="text-accent-text underline">
                    {m.label}
                  </Link>
                ) : (
                  m.label
                )}
              </span>
            ))}
          </div>
          <div role="img" aria-label={bn.public.diaryYearSummary(view.year, view.writtenDays)} className="grid grid-flow-col" style={{ gridTemplateColumns: tpl, gridTemplateRows: `repeat(7, ${CELL}px)`, gap: GAP }}>
            {view.weeks.flatMap((w, wi) =>
              w.map((c, ci) =>
                c ? (
                  <span key={c.key} data-day={c.key} title={c.key} className={`rounded-[3px] ${HEAT[c.level]} data-[today=true]:bg-text`} />
                ) : (
                  <span key={`${wi}-${ci}`} />
                ),
              ),
            )}
          </div>
        </div>
      </div>
      {years.length > 1 && (
        <nav aria-label={bn.public.diaryYearsLabel} className="mt-1 flex flex-wrap gap-2">
          {years.map((y) =>
            y === view.year ? (
              <span key={y} aria-current="page" className="inline-flex min-h-11 items-center rounded-full bg-btn-bg px-4 text-btn-tx">
                {y.toLocaleString("bn-BD", { useGrouping: false })}
              </span>
            ) : (
              <Link key={y} href={diaryYearPath(y)} prefetch={false} className="inline-flex min-h-11 items-center rounded-full border border-line px-4">
                {y.toLocaleString("bn-BD", { useGrouping: false })}
              </Link>
            ),
          )}
        </nav>
      )}
    </section>
  );
}

/** ব্যাজ: মোট দিন · সর্বশেষ টানা · সর্বোচ্চ টানা (build-তারিখ-নিরপেক্ষ) */
export function DiaryStats({ s }: { s: StreakStats }) {
  const chip = "inline-flex min-h-8 items-center rounded-full border border-line bg-surface px-3 text-sm";
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      <li className={chip}>{bn.public.diaryStatTotal(s.total)}</li>
      {s.latest > 1 && <li className={`${chip} text-accent-text`}>🔥 {bn.public.diaryStatLatest(s.latest)}</li>}
      {s.longest > 1 && <li className={chip}>{bn.public.diaryStatLongest(s.longest)}</li>}
    </ul>
  );
}
