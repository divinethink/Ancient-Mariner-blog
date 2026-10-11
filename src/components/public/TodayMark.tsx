"use client";
import { useEffect } from "react";
import { dayKey } from "@/lib/datetime";

/** আজকের ঘর চিহ্নিত করে (static পেজ পুরনো হলেও আজই ঠিক থাকে): সাইট-timezone-এর আজ → `[data-day]`-এ data-today। UI-তে কিছু আঁকে না। */
export function TodayMark({ timeZone }: { timeZone: string }) {
  useEffect(() => {
    try {
      const key = dayKey(new Date(), timeZone);
      document.querySelectorAll(`[data-day="${key}"]`).forEach((el) => {
        el.setAttribute("data-today", "true");
        el.setAttribute("aria-current", "date");
      });
    } catch {
      // timezone অবৈধ হলে শুধু চিহ্ন বাদ; পঞ্জিকা অক্ষত
    }
  }, [timeZone]);
  return null;
}
