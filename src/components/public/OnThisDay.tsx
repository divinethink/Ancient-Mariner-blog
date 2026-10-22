"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { bn } from "@/i18n/bn";
import { dayKey } from "@/lib/datetime";
import { diaryDayPath, sameDayEarlier } from "@/lib/diaryCalendar";

const subscribe = () => () => undefined;

/** 'এই দিনে': আজকের (সাইট-timezone) তারিখে আগের বছরগুলোয় লেখা দিনলিপি। static পেজে শুধু দিন-key পাঠানো হয় (লেখা নয়); আজ ঠিক করে client।
 *  মিল না থাকলে সংক্ষিপ্ত বার্তা (কার্ড সবসময় থাকে — owner-সিদ্ধান্ত ২০২৬-১০-২২); আজ জানার আগে (static HTML) কিছুই আঁকে না, তাই লাফ/ভুল বার্তা নেই */
export function OnThisDay({ days, timeZone }: { days: readonly string[]; timeZone: string }) {
  const today = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return dayKey(new Date(), timeZone);
      } catch {
        return "";
      }
    },
    () => "",
  );
  if (!today) return null;
  const hits = sameDayEarlier(days, today);
  return (
    <section aria-label={bn.public.diaryOnThisDay} className="mt-6 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-serif text-lg font-bold">{bn.public.diaryOnThisDay}</h2>
      {hits.length === 0 && <p className="mt-1 text-muted">{bn.public.diaryOnThisDayEmpty}</p>}
      <ul className="mt-1">
        {hits.map((d) => (
          <li key={d}>
            <Link href={diaryDayPath(d)} prefetch={false} className="inline-flex min-h-11 items-center text-accent-text underline">
              {Number(d.slice(0, 4)).toLocaleString("bn-BD", { useGrouping: false })} সালের এই দিন →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
