import Link from "next/link";
import { bn } from "@/i18n/bn";
import { diaryDayPath } from "@/lib/diaryCalendar";
import type { PlaceStat, YearSummary } from "@/lib/diarySummary";
import { dayLabel } from "./DiaryEntries";

const card = "rounded-xl border border-line bg-surface p-3";
const n = (v: number) => v.toLocaleString("bn-BD");

/** 'বছরের সারসংক্ষেপ' (static): দিন, লেখা, শব্দ, সবচেয়ে লম্বা লেখা, ব্যস্ত মাস, প্রিয় জায়গা। লেখা না থাকলে কিছুই আঁকে না */
export function DiarySummary({ s }: { s: YearSummary }) {
  if (s.days === 0) return null;
  const top = s.places[0];
  return (
    <section aria-label={bn.public.diarySummaryTitle(s.year)} className="mt-6">
      <h2 className="font-serif text-xl font-bold">{bn.public.diarySummaryTitle(s.year)}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        <div className={card}>
          <dt className="text-sm text-muted">{bn.public.diarySumDays}</dt>
          <dd className="text-2xl font-bold">{n(s.days)}</dd>
        </div>
        <div className={card}>
          <dt className="text-sm text-muted">{bn.public.diarySumWords}</dt>
          <dd className="text-2xl font-bold">
            {n(s.words)}
            <span className="ms-1 text-sm font-normal text-muted">({n(s.entries)}{bn.public.diarySumEntries})</span>
          </dd>
        </div>
        {s.longest && (
          <div className={card}>
            <dt className="text-sm text-muted">{bn.public.diarySumLongest}</dt>
            <dd>
              <Link href={diaryDayPath(s.longest.day)} prefetch={false} className="inline-flex min-h-11 items-center text-accent-text underline">
                {dayLabel(s.longest.day)}
              </Link>
            </dd>
          </div>
        )}
        {s.busiestMonth && (
          <div className={card}>
            <dt className="text-sm text-muted">{bn.public.diarySumBusiest}</dt>
            <dd className="font-semibold">
              {bn.diary.months[s.busiestMonth.month - 1]}
              <span className="ms-1 text-sm font-normal text-muted">({bn.public.diarySumBusiestDays(s.busiestMonth.days)})</span>
            </dd>
          </div>
        )}
        {top && (
          <div className={`${card} col-span-2`}>
            <dt className="text-sm text-muted">{bn.public.diarySumPlace}</dt>
            <dd className="font-semibold">
              {top.name}
              <span className="ms-1 text-sm font-normal text-muted">({bn.public.diaryPlacesTimes(top.count)})</span>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

/** জায়গার তালিকা: নাম + কত দিন + তারিখ-লিংক (সবচেয়ে নতুন ১২টা; বাকি সংখ্যায়)। ম্যাপ/স্থানাঙ্ক নেই */
export function PlaceList({ places }: { places: readonly PlaceStat[] }) {
  return (
    <ul className="mt-4 space-y-3">
      {places.map((p) => {
        const shown = p.days.slice(-12).reverse();
        return (
          <li key={p.name} className="rounded-xl border border-line bg-surface p-3">
            <p className="font-semibold">
              {p.name}
              <span className="ms-2 text-sm font-normal text-muted">{bn.public.diaryPlacesTimes(p.count)}</span>
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3">
              {shown.map((d) => (
                <Link key={d} href={diaryDayPath(d)} prefetch={false} className="inline-flex min-h-11 items-center text-sm text-accent-text underline">
                  {dayLabel(d)}
                </Link>
              ))}
              {p.days.length > shown.length && <span className="inline-flex min-h-11 items-center text-sm text-muted">+{n(p.days.length - shown.length)}</span>}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

