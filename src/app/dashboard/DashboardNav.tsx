"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { bn } from "@/i18n/bn";

const item = "flex min-h-12 flex-1 items-center justify-center text-sm text-muted";

// Mobile: bottom-nav (লাইব্রেরি | ⊕ | মেনু); ≥768px: উপরের সারি। editor-এ লুকানো (শুধু লেখা)।
export function DashboardNav() {
  const path = usePathname();
  if (path.startsWith("/dashboard/posts/")) return null;
  const on = (p: string) => (path === p ? "font-semibold text-accent-text" : "");
  return (
    <nav
      aria-label={bn.nav.label}
      className="fixed inset-x-0 bottom-0 z-30 flex items-center border-t border-line bg-surface md:static md:mb-4 md:border-t-0 md:border-b md:bg-transparent"
    >
      <Link href="/dashboard" className={`${item} ${on("/dashboard")}`}>
        {bn.nav.library}
      </Link>
      <Link
        href="/dashboard/posts/new"
        aria-label={bn.nav.newPost}
        className="-mt-6 flex size-14 shrink-0 items-center justify-center rounded-full bg-btn-bg text-3xl text-btn-tx md:mt-0 md:size-11 md:text-2xl"
      >
        ＋
      </Link>
      <Link href="/dashboard/menu" className={`${item} ${on("/dashboard/menu")}`}>
        {bn.nav.menu}
      </Link>
    </nav>
  );
}
