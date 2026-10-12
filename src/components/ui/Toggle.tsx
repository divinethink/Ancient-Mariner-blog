import type { ReactNode } from "react";

// চালু/বন্ধ সুইচ (ধাপ গ): আসলে একটা checkbox (role="switch"), তাই কীবোর্ড/স্ক্রিন-রিডার/ফর্ম-আচরণ আগের মতোই।
// state বাইরে; ট্যাপ-এলাকা ≥৪৪px।
type Props = { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode };

export function Toggle({ checked, onChange, label, hint }: Props) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-1">
      <span className="min-w-0">
        {label}
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full border border-line bg-line transition-colors peer-checked:border-btn-bg peer-checked:bg-btn-bg peer-checked:[&>span]:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent motion-reduce:transition-none"
      >
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-surface shadow transition-transform motion-reduce:transition-none" />
      </span>
    </label>
  );
}
