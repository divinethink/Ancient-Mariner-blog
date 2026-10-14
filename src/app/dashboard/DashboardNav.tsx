"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { bn } from "@/i18n/bn";
import { useAdd } from "./AddSheet";

const item = "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs text-muted";

/** <1024px: bottom-nav (৫ আইটেম: লাইব্রেরি, প্রজেক্ট, ＋, দিনলিপি, মেনু) / উপরের সারি; editor-এ লুকানো (শুধু লেখা) */
export function TopNav() {
  const path = usePathname();
  const { openMenu } = useAdd();
  if (path.startsWith("/dashboard/posts/")) return null;
  // লাইব্রেরি শুধু ঠিক-মিলে (বাকি সব পেজ /dashboard/... — নইলে সবসময় active); অন্যগুলো সাব-পথসহ
  const isOn = (p: string) => (p === "/dashboard" ? path === p : path === p || path.startsWith(`${p}/`));
  const link = (href: string, icon: IconName, label: string) => {
    const on = isOn(href);
    return (
      <Link href={href} aria-current={on ? "page" : undefined} className={`${item} ${on ? "font-semibold text-accent-text" : ""}`}>
        <Icon name={icon} strokeWidth={on ? 2.4 : 1.8} />
        <span className="max-w-full truncate px-1">{label}</span>
      </Link>
    );
  };
  return (
    <nav
      aria-label={bn.nav.label}
      className="fixed inset-x-0 bottom-0 z-30 flex items-center border-t border-line bg-surface md:static md:mb-4 md:border-t-0 md:border-b md:bg-transparent lg:hidden"
    >
      {link("/dashboard", "library", bn.nav.library)}
      {link("/dashboard/projects", "projects", bn.nav.projects)}
      <button
        type="button"
        onClick={openMenu}
        aria-haspopup="dialog"
        aria-label={bn.nav.add}
        className="-mt-6 flex size-14 shrink-0 items-center justify-center rounded-full bg-btn-bg text-btn-tx md:mt-0 md:size-11"
      >
        <Icon name="plus" size={26} strokeWidth={2.2} />
      </button>
      {link("/dashboard/diary", "diary", bn.nav.diary)}
      {link("/dashboard/menu", "menu", bn.nav.menu)}
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
  // ক্রম: খুঁজুন → লাইব্রেরি → প্রজেক্ট → নতুন লেখা → দ্রুত ভাবনা → দিনলিপি → মেনু (পূর্ণ-লেখা খোঁজ প্যালেটের ভেতরে)
  const linksTop: { href: string; icon: IconName; label: string }[] = [
    { href: "/dashboard", icon: "library", label: bn.nav.library },
    { href: "/dashboard/projects", icon: "projects", label: bn.nav.projects },
    { href: "/dashboard/posts/new", icon: "plus", label: bn.nav.newPost },
  ];
  const linksBottom: { href: string; icon: IconName; label: string }[] = [
    { href: "/dashboard/diary", icon: "diary", label: bn.nav.diary },
    { href: "/dashboard/menu", icon: "menu", label: bn.nav.menu },
  ];
  const renderLink = (l: { href: string; icon: IconName; label: string }) => (
    <Link key={l.href} href={l.href} aria-label={l.label} title={l.label} className={side(l.href)}>
      <Icon name={l.icon} size={20} />
      {!collapsed && <span>{l.label}</span>}
    </Link>
  );
  return (
    <nav
      aria-label={bn.nav.label}
      className="chrome fixed inset-y-0 left-0 z-30 hidden w-[var(--nav-w)] flex-col gap-1 border-r border-line bg-surface p-3 lg:flex"
    >
      <button
        type="button"
        onClick={onSearch}
        aria-haspopup="dialog"
        aria-label={bn.nav.search}
        title={bn.nav.search}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-line ${collapsed ? "justify-center" : ""}`}
      >
        <Icon name="search" size={20} />
        {!collapsed && <span>{bn.nav.searchLabel}</span>}
      </button>
      {linksTop.map(renderLink)}
      <button
        type="button"
        onClick={openIdea}
        aria-haspopup="dialog"
        aria-label={bn.nav.quickIdea}
        title={bn.nav.quickIdea}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-line ${collapsed ? "justify-center" : ""}`}
      >
        <Icon name="idea" size={20} />
        {!collapsed && <span>{bn.nav.quickIdea}</span>}
      </button>
      {linksBottom.map(renderLink)}
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
