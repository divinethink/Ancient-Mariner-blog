import Link from "next/link";
import { bn } from "@/i18n/bn";
import type { DiaryMonthView } from "@/lib/diaryCalendar";
import { CalendarKeepPos } from "./CalendarKeepPos";
import { KEEP_POS_HIDE } from "./keepPosScript";
import { TodayMark } from "./TodayMark";

// হিটম্যাপ: accent-এর স্বচ্ছতা বাড়ে (০ = লেখা নেই); আজ = accent রিং + বোল্ড (ভরাট নয়), নির্বাচিত = accent-ভরা, লেখার দিন = টিন্ট — তিনটা আলাদা
const HEAT = ["", "bg-accent/15", "bg-accent/30", "bg-accent/50", "bg-accent/70"] as const;
const base = "flex min-h-11 items-center justify-center rounded-lg data-[today=true]:ring-2 data-[today=true]:ring-accent-text data-[today=true]:font-bold data-[today=true]:text-accent-text";
const nav = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg";

/** "দিনলিপি পঞ্জিকা": লেখা-আছে এমন দিন হিটম্যাপ-রঙে ও লিংক; নির্বাচিত দিনে রিং; আজ আলাদা রঙে ভরা (TodayMark)। সাইডবার ও /diary দুই জায়গায় একই */
export function DiaryCalendar({ view, selected, timeZone }: { view: DiaryMonthView; selected?: string; timeZone: string }) {
  const slots = [...Array<null>(view.lead).fill(null), ...view.cells];
  while (slots.length < 42 || slots.length % 7 !== 0) slots.push(null); // সবসময় ৬ সারি: মাস বদলালে উচ্চতা লাফায় না
  const weeks = Array.from({ length: slots.length / 7 }, (_, i) => slots.slice(i * 7, i * 7 + 7));
  const arrow = (href: string | undefined, label: string, ch: string) =>
    href ? (
      <Link href={href} prefetch={false} scroll={false} aria-label={label} className={nav}>
        {ch}
      </Link>
    ) : (
      <span aria-hidden="true" className={`${nav} text-muted`}>
        {ch}
      </span>
    );
  return (
    <div data-diary-cal="">
      <TodayMark timeZone={timeZone} />
      <script dangerouslySetInnerHTML={{ __html: KEEP_POS_HIDE }} />
      <CalendarKeepPos />
      <div className="mb-1 flex items-center justify-between font-semibold">
        {arrow(view.prev, bn.public.prevMonth, "‹")}
        <span>{view.label}</span>
        {arrow(view.next, bn.public.nextMonth, "›")}
      </div>
      <table className="w-full table-fixed text-center text-sm">
        <caption className="sr-only">{view.label}</caption>
        <thead>
          <tr>
            {bn.public.weekdays.map((d, i) => (
              <th key={d} scope="col" abbr={bn.public.weekdaysFull[i]} className="font-medium text-muted">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, wi) => (
            <tr key={wi}>
              {w.map((c, ci) => (
                <td key={ci} className="h-12 p-0.5">
                  {c &&
                    (c.href ? (
                      <Link
                        href={c.href}
                        prefetch={false}
                        scroll={false}
                        data-day={c.key}
                        aria-current={selected === c.key ? "page" : undefined}
                        className={`${base} ${HEAT[c.level]} font-semibold ${selected === c.key ? "bg-btn-bg! text-btn-tx!" : ""}`}
                      >
                        {c.day.toLocaleString("bn-BD")}
                      </Link>
                    ) : (
                      <span data-day={c.key} className={`${base} text-muted`}>
                        {c.day.toLocaleString("bn-BD")}
                      </span>
                    ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 flex flex-wrap items-center gap-x-1 text-xs text-muted" aria-hidden="true">
        {bn.public.diaryLess}
        {HEAT.slice(1).map((h) => (
          <span key={h} className={`inline-block size-3 rounded-sm border border-line ${h}`} />
        ))}
        {bn.public.diaryMore}
        <span className="ms-2 inline-block size-3 rounded-sm border-2 border-accent-text" />
        {bn.public.diaryToday}
      </p>
    </div>
  );
}
