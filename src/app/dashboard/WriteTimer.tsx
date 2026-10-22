"use client";

import { useEffect, useState } from "react";
import { bn } from "@/i18n/bn";

const TOTAL_MS = 15 * 60_000;
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
};

/** ঐচ্ছিক ১৫ মিনিটের লেখা-টাইমার: নিজে চাপলে চলে; শেষে শুধু শান্ত বার্তা (শব্দ/কম্পন/streak/শাস্তি নেই); সংরক্ষণে কোনো প্রভাব নেই। state শুধু এই sheet-এ */
export function WriteTimer() {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState(TOTAL_MS);
  const done = endAt !== null && left <= 0;
  useEffect(() => {
    if (endAt === null) return;
    const tick = () => setLeft(endAt - Date.now());
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endAt]);
  if (endAt === null)
    return (
      <button
        type="button"
        onClick={() => {
          setLeft(TOTAL_MS);
          setEndAt(Date.now() + TOTAL_MS);
        }}
        className="min-h-11 rounded-full border border-line px-3 text-sm"
      >
        {bn.diary.timerStart}
      </button>
    );
  return (
    <span role="timer" className="inline-flex min-h-11 items-center gap-2 text-sm">
      <span aria-live="off" className={done ? "text-muted" : "font-semibold"}>
        {done ? bn.diary.timerDone : bn.diary.timerRunning(mmss(left))}
      </span>
      <button type="button" onClick={() => setEndAt(null)} className="min-h-11 rounded-full border border-line px-3">
        {bn.diary.timerStop}
      </button>
    </span>
  );
}
