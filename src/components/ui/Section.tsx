"use client";

import { useId, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";

// ভাঁজযোগ্য সেকশন-কার্ড (ধাপ গ): শিরোনাম ট্যাপে খোলে/বন্ধ হয়। ভেতরের ইনপুট বন্ধ অবস্থাতেও DOM-এ থাকে (`hidden`),
// তাই মান/ফর্ম-state অক্ষত। `forceOpen` = ভুল থাকলে জোর করে খোলা, যাতে ত্রুটি-বার্তা লুকিয়ে না থাকে।
type Props = {
  title: string;
  /** বন্ধ অবস্থার ছোট লাইন (বর্তমান মান) */
  summary?: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: ReactNode;
};

export function Section({ title, summary, defaultOpen = false, forceOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const shown = open || forceOpen;
  return (
    <section className="rounded-2xl border border-line bg-surface">
      <h2>
        <button
          type="button"
          aria-expanded={shown}
          aria-controls={id}
          onClick={() => setOpen(!shown)}
          className="flex min-h-12 w-full items-center gap-2 px-4 py-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-lg font-bold">{title}</span>
            {!shown && summary && <span className="block truncate text-sm font-normal text-muted">{summary}</span>}
          </span>
          <Icon name="chevron" size={18} className={`shrink-0 text-muted transition-transform motion-reduce:transition-none ${shown ? "rotate-90" : ""}`} />
        </button>
      </h2>
      <div id={id} hidden={!shown} className="space-y-4 border-t border-line p-4">
        {children}
      </div>
    </section>
  );
}
