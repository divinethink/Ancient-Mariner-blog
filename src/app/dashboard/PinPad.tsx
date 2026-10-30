"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PIN_LENGTH } from "@/lib/passcode";
import { bn } from "@/i18n/bn";

const BN_DIGIT = "০১২৩৪৫৬৭৮৯";

/** ৪-অঙ্কের PIN কীপ্যাড (নিজস্ব — ফোনের কীবোর্ড খোলে না)। ৪টা অঙ্ক হলে onComplete(pin) ডেকে নিজেই ফাঁকা হয়। */
export function PinPad({
  title,
  subtitle,
  error,
  disabled = false,
  onComplete,
}: {
  title: string;
  subtitle?: string;
  error?: string | null;
  disabled?: boolean;
  onComplete: (pin: string) => void;
}) {
  const [digits, setDigits] = useState("");
  const cb = useRef(onComplete);
  useEffect(() => {
    cb.current = onComplete;
  });

  // digits ref-এও রাখা: setState-updater-এর ভেতরে side-effect নয় (StrictMode-এ দুবার চলত)
  const ref = useRef("");
  const set = (v: string) => {
    ref.current = v;
    setDigits(v);
  };
  const press = useCallback(
    (d: string) => {
      if (disabled || ref.current.length >= PIN_LENGTH) return;
      const next = ref.current + d;
      set(next);
      if (next.length === PIN_LENGTH) {
        setTimeout(() => {
          cb.current(next);
          set("");
        }, 120);
      }
    },
    [disabled],
  );
  const back = useCallback(() => {
    if (ref.current.length < PIN_LENGTH) set(ref.current.slice(0, -1));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [press, back]);

  const key =
    "flex h-16 items-center justify-center rounded-2xl border border-line bg-surface text-2xl font-medium transition-colors active:bg-line disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none";
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center">
      <h2 className="font-serif text-xl font-bold">{title}</h2>
      {subtitle && <p className="mt-1 text-center text-sm text-muted">{subtitle}</p>}
      <div
        className="my-6 flex gap-4"
        role="status"
        aria-label={bn.appLock.digits.replace("{n}", String(digits.length))}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={`size-4 rounded-full border-2 border-accent-text transition-colors motion-reduce:transition-none ${i < digits.length ? "bg-accent-text" : ""}`}
          />
        ))}
      </div>
      <p role="alert" className="mb-3 min-h-5 text-center text-sm text-red-700 dark:text-red-400">
        {digits.length === 0 ? error : ""}
      </p>
      <div className="grid w-full grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" disabled={disabled} aria-label={d} onClick={() => press(d)} className={key}>
            {BN_DIGIT[Number(d)]}
          </button>
        ))}
        <span />
        <button type="button" disabled={disabled} aria-label="0" onClick={() => press("0")} className={key}>
          {BN_DIGIT[0]}
        </button>
        <button type="button" disabled={disabled} aria-label={bn.appLock.del} onClick={back} className={key}>
          <span aria-hidden="true">⌫</span>
        </button>
      </div>
    </div>
  );
}
