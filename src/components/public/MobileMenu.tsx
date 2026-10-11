"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import { bn } from "@/i18n/bn";

/** পাবলিক header-এর মোবাইল ☰ মেনু (<760px): Esc / বাইরে-ট্যাপে বন্ধ, aria-expanded; ≥760px-এ লুকানো */
export function MobileMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="relative min-[760px]:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={bn.public.menuButton}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-surface text-xl"
      >
        ☰
      </button>
      {open && (
        <>
          <div aria-hidden className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div id={id} onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)} className="absolute end-0 z-20 mt-1 flex min-w-56 flex-col rounded-xl border border-line bg-surface p-2 shadow">
            {children}
          </div>
        </>
      )}
    </div>
  );
}
