"use client";

import { useId, type ReactNode } from "react";
import { Icon } from "@/components/icons";

// ভাঁজযোগ্য তালিকা-সারি (ধাপ খ): বন্ধ অবস্থায় এক লাইন (শিরোনাম + ছোট বিবরণ) ও ডানে কাজের বোতাম; ট্যাপে খোলে।
// state (খোলা/বন্ধ) বাইরে থাকে — এটা শুধু চেহারা; ফর্ম-মান/save-লজিকে হাত নেই।
type Props = {
  title: string;
  /** বন্ধ অবস্থার ছোট লাইন (ধরন · গন্তব্য) */
  sub?: string;
  /** true হলে সারি-বর্ডার ও বিবরণ সতর্ক-রঙে */
  invalid?: boolean;
  open: boolean;
  onToggle: () => void;
  /** ডানের বোতাম (↑ ↓ ✕) */
  actions?: ReactNode;
  children: ReactNode;
};

export function ItemCard({ title, sub, invalid, open, onToggle, actions, children }: Props) {
  const id = useId();
  return (
    <li className={`rounded-2xl border bg-surface ${invalid ? "border-accent" : "border-line"}`}>
      <div className="flex items-center gap-1 py-1 pl-3 pr-1.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{title}</span>
            {sub && <span className={`block truncate text-sm ${invalid ? "text-accent-text" : "text-muted"}`}>{sub}</span>}
          </span>
          <Icon name="chevron" size={18} className={`shrink-0 text-muted transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`} />
        </button>
        {actions}
      </div>
      {open && (
        <div id={id} className="space-y-3 border-t border-line p-3">
          {children}
        </div>
      )}
    </li>
  );
}
