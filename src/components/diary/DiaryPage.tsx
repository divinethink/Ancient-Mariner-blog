import type { ReactNode } from "react";
import { bn } from "@/i18n/bn";
import { DIARY_LAYOUT, type DiaryLook } from "@/lib/diaryLook";

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
const DAY_MS = 86_400_000;

/** ISO সপ্তাহ-নম্বর (সোমবার-শুরু, ১ম বৃহস্পতিবারের সপ্তাহ = ১) — শুধু "সাপ্তাহিক" থিমের লেখায় */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - y0) / DAY_MS + 1) / 7);
}

const Pin = () => (
  <svg aria-hidden viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="currentColor" className="dico">
    <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
  </svg>
);
const Sun = () => (
  <svg aria-hidden viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="dico">
    <circle cx="12" cy="12" r="4" stroke="none" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" fill="none" />
  </svg>
);
const Moon = () => (
  <svg aria-hidden viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="currentColor" className="dico">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </svg>
);

/**
 * ডায়েরির একটি পাতা (পাবলিক ও ড্যাশবোর্ড দুই জায়গায় একই): বড় তারিখ, মাস-বছর, বার; রুলড লাইনের ওপর লেখা।
 * হুক/state নেই — server ও client দুই component থেকেই চলে। চেহারা `data-dtheme|dlayout|dfont|dsize` দিয়ে (CSS: globals.css)।
 * `day` = "YYYY-MM-DD"; তারিখ UTC-তে গণিত, তাই দিন সরে না। অবৈধ day হলে শিরোনাম-অংশ বাদ, বাকি অক্ষত।
 * `period` = "বেলা" (সকাল/দুপুর…) — পুরনো ৮ থিমে দেখা যায় না; নতুন থিমে স্থানের পাশে চিপ হয়ে আসে।
 */
export function DiaryPage({
  day,
  title,
  location,
  period,
  night,
  look,
  footer,
  children,
}: {
  day: string;
  title?: string;
  location?: string;
  period?: string;
  /** "রাত" হলে চিপে চাঁদ-আইকন (নইলে সূর্য) */
  night?: boolean;
  look: DiaryLook;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const d = new Date(`${day}T12:00:00Z`);
  const ok = !Number.isNaN(d.getTime());
  const layout = DIARY_LAYOUT[look.theme];
  const weekDays = ok && layout === "week" ? Array.from({ length: 7 }, (_, i) => new Date(d.getTime() + (i - d.getUTCDay()) * DAY_MS)) : null;
  const month = ok ? bn.diary.months[d.getUTCMonth()] : "";
  const year = ok ? bnNum(d.getUTCFullYear()) : "";
  return (
    <div className="dpage" data-dtheme={look.theme} data-dfont={look.font} data-dsize={look.size} {...(layout !== "classic" && { "data-dlayout": layout })}>
      <p className="dheading" aria-hidden="true">
        {bn.diary.pageHeading}
      </p>
      {ok && (
        <div className="dhead">
          <time className="dnum" dateTime={day}>
            {bnNum(d.getUTCDate())}
          </time>
          <span className="dmeta">
            <span className="dmy">
              <span className="dm">{month}</span> <span className="dy">{year}</span>
              {layout === "week" && <span className="dwk"> · {bn.diary.weekLbl} {bnNum(isoWeek(d))}</span>}
            </span>
            <span className="dwd">{bn.public.weekdaysFull[d.getUTCDay()]}</span>
          </span>
        </div>
      )}
      {weekDays && (
        <div className="dweek" aria-hidden="true">
          {weekDays.map((w, i) => (
            <span key={i} className={`dwday${i === d.getUTCDay() ? " on" : ""}`}>
              <i>{bn.diary.weekdays[i]}</i>
              <b>{bnNum(w.getUTCDate())}</b>
            </span>
          ))}
        </div>
      )}
      <div className="dbody">
        {title && <h3 className="dtitle">{title}</h3>}
        {location && (
          <p className="dplace">
            {bn.diary.labelPlace}: {location}
          </p>
        )}
        {(location || period) && (
          <p className="dchips">
            {location && (
              <span className="dchip">
                <Pin />
                <span className="dk">{bn.diary.labelPlace}</span>
                <span className="dv">{location}</span>
              </span>
            )}
            {period && (
              <span className="dchip">
                {night ? <Moon /> : <Sun />}
                <span className="dk">{bn.diary.labelPeriod}</span>
                <span className="dv">{period}</span>
              </span>
            )}
          </p>
        )}
        <div className="dtext">{children}</div>
      </div>
      {footer && <div className="dfoot">{footer}</div>}
    </div>
  );
}
