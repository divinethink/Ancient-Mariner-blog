"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { bn } from "@/i18n/bn";
import { dayKey } from "@/lib/datetime";
import { diaryDayPath, sameDayEarlier } from "@/lib/diaryCalendar";

const subscribe = () => () => undefined;

/** 'এই দিনে': আজকের (সাইট-timezone) তারিখে আগের বছরগুলোয় লেখা দিনলিপি। static পেজে শুধু দিন-key পাঠানো হয় (লেখা নয়); আজ ঠিক করে client। মিল না থাকলে কিছুই আঁকে না */
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
  const hits = today ? sameDayEarlier(days, today) : [];
  if (!hits.length) return null;
  return (
    <section aria-label={bn.public.diaryOnThisDay} className="mt-6 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-serif text-lg font-bold">{bn.public.diaryOnThisDay}</h2>
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
