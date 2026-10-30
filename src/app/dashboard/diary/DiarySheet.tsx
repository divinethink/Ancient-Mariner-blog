"use client";

// দিনলিপির দুই bottom-sheet-এর (থিম ও ফন্ট · ডাউনলোড) একই কাঠামো: শিরোনাম + ✕ আইকন · স্ক্রলযোগ্য মাঝখান · নিচে স্থায়ী বার।
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/icons";

type Props = {
  title: string;
  closeLabel: string;
  onClose: () => void;
  /** true হলে Esc/ব্যাকড্রপ/✕ বন্ধ (কাজ চলাকালীন) */
  busy?: boolean;
  /** নিচের স্থায়ী বার (বোতাম/সারাংশ) */
  footer: ReactNode;
  children: ReactNode;
};

export function DiarySheet({ title, closeLabel, onClose, busy = false, footer, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose, busy]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button type="button" aria-label={closeLabel} onClick={onClose} disabled={busy} className="absolute inset-0 bg-black/40" tabIndex={-1} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-3xl bg-bg md:rounded-3xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="font-serif text-xl font-bold">{title}</h2>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            disabled={busy}
            className="flex size-11 items-center justify-center rounded-full border border-line text-muted disabled:opacity-50"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-2">{children}</div>
        <div className="space-y-2 border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>
      </div>
    </div>
  );
}
