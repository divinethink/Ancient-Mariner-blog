import Link from "next/link";
import { bn } from "@/i18n/bn";
import type { DiaryMonthView } from "@/lib/diaryCalendar";
import { CalendarKeepPos } from "./CalendarKeepPos";
import { KEEP_POS_HIDE } from "./keepPosScript";
import { TodayMark } from "./TodayMark";

// আকৃতি + রং দুটোই আলাদা (owner-সিদ্ধান্ত ২০২৬-১০-২২; রঙ-নির্ভর নয়): লেখার দিন = পাতলা রেখার সার্কেল; নির্বাচিত = accent-ভরা সার্কেল;
// আজ = `--today` রঙের গোল-কোণা স্কয়ার (TodayMark `data-today` বসায়, তাই `group-data`); আজ + লেখা আছে = স্কয়ারের ভেতরে সাদা সার্কেল।
const base = "group relative flex min-h-11 items-center justify-center";
const shape = "relative inline-flex size-9 items-center justify-center rounded-full group-data-[today=true]:rounded-lg group-data-[today=true]:bg-today! group-data-[today=true]:text-today-tx group-data-[today=true]:font-bold";
const nav = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg";

/** "দিনলিপি পঞ্জিকা": লেখা-আছে এমন দিন সার্কেল-সহ লিংক (রঙ-শেড নেই; বছরের হিটম্যাপ আলাদা, অপরিবর্তিত); নির্বাচিত দিনে রিং; আজ আলাদা রঙে ভরা (TodayMark)। সাইডবার ও /diary দুই জায়গায় একই */
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
                        data-sel={selected === c.key ? "true" : "false"}
                        className={base}
                      >
                        <span
                          className={`${shape} border-[1.5px] border-accent-text font-semibold group-data-[today=true]:border-transparent group-data-[sel=true]:bg-btn-bg group-data-[sel=true]:text-btn-tx group-data-[sel=true]:group-data-[today=true]:ring-2 group-data-[sel=true]:group-data-[today=true]:ring-today group-data-[sel=true]:group-data-[today=true]:ring-offset-2 group-data-[sel=true]:group-data-[today=true]:ring-offset-bg`}
                        >
                          {c.day.toLocaleString("bn-BD")}
                          <span aria-hidden="true" className="absolute inset-1.5 hidden rounded-full border-[1.5px] border-today-tx group-data-[today=true]:block" />
                        </span>
                      </Link>
                    ) : (
                      <span data-day={c.key} className={`${base} text-muted`}>
                        <span className={shape}>{c.day.toLocaleString("bn-BD")}</span>
                      </span>
                    ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 flex flex-wrap items-center gap-x-1 text-xs text-muted" aria-hidden="true">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-3.5 rounded-full border-[1.5px] border-accent-text" />
          {bn.public.diaryHasEntry}
        </span>
        <span className="ms-3 inline-flex items-center gap-1">
          <span className="inline-block size-3.5 rounded bg-today" />
          {bn.public.diaryToday}
        </span>
      </p>
    </div>
  );
}
