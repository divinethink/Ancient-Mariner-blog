import type { ReactNode } from "react";

// ছোট সংখ্যা-কার্ড (ধাপ ক): লেবেল + বড় মান। পাশাপাশি দুটো বসানোর জন্য প্যাডিং কম।
export function StatCard({ icon, label, children }: { icon?: string; label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <p className="text-sm text-muted">
        {icon && <span aria-hidden="true">{icon} </span>}
        {label}
      </p>
      <p className="mt-1 flex flex-wrap items-baseline text-3xl font-bold">{children}</p>
    </div>
  );
}
