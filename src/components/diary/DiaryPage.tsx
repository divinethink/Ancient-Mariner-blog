import type { ReactNode } from "react";
import { bn } from "@/i18n/bn";
import type { DiaryLook } from "@/lib/diaryLook";

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });

/**
 * ডায়েরির একটি পাতা (পাবলিক ও ড্যাশবোর্ড দুই জায়গায় একই): বড় তারিখ, মাস-বছর, বার; রুলড লাইনের ওপর লেখা।
 * হুক/state নেই — server ও client দুই component থেকেই চলে। চেহারা `data-dtheme|dfont|dsize` দিয়ে (CSS: globals.css)।
 * `day` = "YYYY-MM-DD"; তারিখ UTC-তে গণিত, তাই দিন সরে না। অবৈধ day হলে শিরোনাম-অংশ বাদ, বাকি অক্ষত।
 */
export function DiaryPage({
  day,
  title,
  location,
  look,
  footer,
  children,
}: {
  day: string;
  title?: string;
  location?: string;
  look: DiaryLook;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const d = new Date(`${day}T12:00:00Z`);
  const ok = !Number.isNaN(d.getTime());
  return (
    <div className="dpage" data-dtheme={look.theme} data-dfont={look.font} data-dsize={look.size}>
      <p className="dheading" aria-hidden="true">
        {bn.diary.pageHeading}
      </p>
      {ok && (
        <div className="dhead">
          <time className="dnum" dateTime={day}>
            {bnNum(d.getUTCDate())}
          </time>
          <span className="dmeta">
            <span>
              {bn.diary.months[d.getUTCMonth()]} {bnNum(d.getUTCFullYear())}
            </span>
            <span>{bn.public.weekdaysFull[d.getUTCDay()]}</span>
          </span>
        </div>
      )}
      <div className="dbody">
        {title && <h3 className="dtitle">{title}</h3>}
        {location && (
          <p className="dplace">
            {bn.diary.labelPlace}: {location}
          </p>
        )}
        <div className="dtext">{children}</div>
      </div>
      {footer && <div className="dfoot">{footer}</div>}
    </div>
  );
}
