import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

/** মেনুর একটি সারি (আইকন + লেবেল + ›); ≥৪৮px টাচ-টার্গেট */
export function MenuRow({ href, icon, label, external = false }: { href: string; icon: IconName; label: string; external?: boolean }) {
  const cls = "flex min-h-12 items-center gap-3 px-4";
  if (external)
    // নতুন ট্যাবে (লেখার অবস্থা হারায় না); পাবলিক সাইট static, তাই Next <Link> নয়
    return (
      <li>
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          <Icon name={icon} size={20} className="shrink-0 text-muted" />
          <span className="flex-1">{label}</span>
          <span aria-hidden="true" className="shrink-0 text-muted">↗</span>
        </a>
      </li>
    );
  return (
    <li>
      <Link href={href} className={cls}>
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
