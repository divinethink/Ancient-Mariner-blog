import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

/** মেনুর একটি সারি (আইকন + লেবেল + ›); ≥৪৮px টাচ-টার্গেট */
export function MenuRow({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-12 items-center gap-3 px-4">
        <Icon name={icon} size={20} className="shrink-0 text-muted" />
        <span className="flex-1">{label}</span>
        <Icon name="chevron" size={18} className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}

/** গ্রুপ-হেডিং + কার্ড-তালিকা */
export function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mb-5">
      <h2 className="mb-1.5 px-1 text-sm text-muted">{title}</h2>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">{children}</ul>
    </section>
  );
}
