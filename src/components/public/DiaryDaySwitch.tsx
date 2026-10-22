"use client";
import { useEffect } from "react";

const DAY_PATH = /^\/diary\/(\d{4}-\d{2}-\d{2})\/?$/;

/**
 * পাবলিক দিনলিপিতে একই মাসের দিন বদলালে পাতা নতুন করে লোড হয় না (লাফ/ঝিলিক নেই):
 * মাসের সব দিনের লেখা পাতাতেই `[data-diary-panel]`-এ থাকে; ট্যাপে শুধু সেই দিনেরটা দেখানো হয় ও পঞ্জিকার নির্বাচন সরে।
 * JS না চললে বা অন্য মাসের লিংক হলে আগের মতো সাধারণ লিংকেই যায়। URL বদলায় না (dashboard-দিনলিপির মতো)।
 */
export function DiaryDaySwitch() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-diary-panels]");
    if (!root) return;
    const panels = () => [...root.querySelectorAll<HTMLElement>("[data-diary-panel]")];
    let current = panels().find((p) => !p.hidden)?.dataset.diaryPanel;
    const show = (day: string) => {
      panels().forEach((p) => {
        p.hidden = p.dataset.diaryPanel !== day;
      });
      document.querySelectorAll<HTMLElement>("[data-diary-cal] a[data-day]").forEach((a) => {
        const on = a.dataset.day === day;
        a.classList.toggle("bg-btn-bg!", on);
        a.classList.toggle("text-btn-tx!", on);
        if (on) {
          if (a.getAttribute("aria-current") !== "date") a.setAttribute("aria-current", "page");
        } else if (a.getAttribute("aria-current") === "page") a.removeAttribute("aria-current");
      });
      root.setAttribute("data-switched", "");
      current = day;
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.closest("[data-diary-cal],[data-diary-panels]")) return;
      let u: URL;
      try {
        u = new URL(a.href, location.href);
      } catch {
        return;
      }
      if (u.origin !== location.origin) return;
      const day = DAY_PATH.exec(u.pathname)?.[1];
      if (!day || day === current || !panels().some((p) => p.dataset.diaryPanel === day)) return;
      e.preventDefault();
      e.stopPropagation(); // Next Link ও CalendarKeepPos-এর "পাতা-লোড" ধরা বন্ধ
      show(day);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
