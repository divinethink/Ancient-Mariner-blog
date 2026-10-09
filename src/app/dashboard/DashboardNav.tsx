"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { bn } from "@/i18n/bn";
import { useAdd } from "./AddSheet";

const item = "flex min-h-12 flex-1 items-center justify-center text-sm text-muted";

/** <1024px: bottom-nav / উপরের সারি; editor-এ লুকানো (শুধু লেখা) */
export function TopNav() {
  const path = usePathname();
  const { openMenu } = useAdd();
  if (path.startsWith("/dashboard/posts/")) return null;
  const on = (p: string) => (path === p ? "font-semibold text-accent-text" : "");
  return (
    <nav
      aria-label={bn.nav.label}
      className="fixed inset-x-0 bottom-0 z-30 flex items-center border-t border-line bg-surface md:static md:mb-4 md:border-t-0 md:border-b md:bg-transparent lg:hidden"
    >
      <Link href="/dashboard" className={`${item} ${on("/dashboard")}`}>
        {bn.nav.library}
      </Link>
      <button
        type="button"
        onClick={openMenu}
        aria-haspopup="dialog"
        aria-label={bn.nav.add}
        className="-mt-6 flex size-14 shrink-0 items-center justify-center rounded-full bg-btn-bg text-3xl text-btn-tx md:mt-0 md:size-11 md:text-2xl"
      >
        ＋
      </button>
      <Link href="/dashboard/menu" className={`${item} ${on("/dashboard/menu")}`}>
        {bn.nav.menu}
      </Link>
    </nav>
  );
}

/** ≥1024px: বাঁ panel (editor-এও; ফোকাস মোডে টাইপ চলাকালে মিলিয়ে যায়) */
export function SidePanel({
  collapsed,
  onToggle,
  onSearch,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onSearch: () => void;
}) {
  const path = usePathname();
  const { openIdea } = useAdd();
  const side = (p: string) =>
    `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${collapsed ? "justify-center" : ""} ${
      path === p ? "bg-line font-semibold text-accent-text" : "text-muted hover:bg-line"
    }`;
  const links = [
    { href: "/dashboard", icon: "📚", label: bn.nav.library },
    { href: "/dashboard/posts/new", icon: "✏️", label: bn.nav.newPost },
    { href: "/dashboard/menu", icon: "☰", label: bn.nav.menu },
  ];
  return (
    <nav
      aria-label={bn.nav.label}
      className="chrome fixed inset-y-0 left-0 z-30 hidden w-[var(--nav-w)] flex-col gap-1 border-r border-line bg-surface p-3 lg:flex"
    >
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-label={l.label}
          title={l.label}
          className={side(l.href)}
        >
          <span aria-hidden>{l.icon}</span>
          {!collapsed && <span>{l.label}</span>}
        </Link>
      ))}
      <button
        type="button"
        onClick={openIdea}
        aria-haspopup="dialog"
        aria-label={bn.nav.quickIdea}
        title={bn.nav.quickIdea}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-line ${collapsed ? "justify-center" : ""}`}
      >
        <span aria-hidden>💡</span>
        {!collapsed && <span>{bn.nav.quickIdea}</span>}
      </button>
      <button
        type="button"
        onClick={onSearch}
        aria-haspopup="dialog"
        aria-label={bn.nav.search}
        title={bn.nav.search}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-line ${collapsed ? "justify-center" : ""}`}
      >
        <span aria-hidden>🔍</span>
        {!collapsed && <span>{bn.nav.searchLabel}</span>}
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? bn.nav.expand : bn.nav.collapse}
        title={collapsed ? bn.nav.expand : bn.nav.collapse}
        className="mt-auto flex min-h-11 items-center justify-center rounded-xl text-muted hover:bg-line"
      >
        {collapsed ? "»" : "«"}
      </button>
    </nav>
  );
}
