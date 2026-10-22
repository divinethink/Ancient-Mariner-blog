"use client";
import { useLayoutEffect } from "react";
import { KEEP_POS_KEY as KEY } from "./keepPosScript";

/**
 * পঞ্জিকায় তারিখ/মাসে ট্যাপ করলে পাতা নতুন করে লোড হয় (static সাইট) → স্ক্রল ওপরে চলে যায়।
 * ট্যাপের সময় পঞ্জিকার ওপরের দূরত্ব (viewport থেকে) মনে রাখি; নতুন পাতায় পঞ্জিকা ঠিক ওই জায়গায় বসাই — লাফ নেই।
 * sessionStorage না চললে চুপচাপ বাদ; ৮ সেকেন্ডের পুরনো মান উপেক্ষা।
 */
export function CalendarKeepPos() {
  useLayoutEffect(() => {
    const show = () => {
      document.documentElement.style.visibility = "";
    };
    try {
      const raw = sessionStorage.getItem(KEY);
      sessionStorage.removeItem(KEY);
      // একই পাতায় একাধিক পঞ্জিকা থাকতে পারে (সাইডবার + মূল) → প্রথম দৃশ্যমানটি
      const el = [...document.querySelectorAll<HTMLElement>("[data-diary-cal]")].find((x) => x.offsetParent !== null);
      if (raw && el) {
        const { top, t } = JSON.parse(raw) as { top: number; t: number };
        if (Date.now() - t < 8000) {
          const fix = () => window.scrollBy(0, el.getBoundingClientRect().top - top);
          fix();
          requestAnimationFrame(() => {
            fix(); // browser-এর নিজস্ব scroll-restore পরে চললে আবার মেলাই
            show();
          });
        } else show();
      } else show();
    } catch {
      show(); // storage নেই/অবৈধ মান: শুধু বাদ
    }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a");
      const el = a?.closest<HTMLElement>("[data-diary-cal]");
      if (!a || !el) return;
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ top: el.getBoundingClientRect().top, t: Date.now() }));
      } catch {
        // বাদ
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
