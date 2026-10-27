"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { bn } from "@/i18n/bn";
import { useAdd } from "./AddSheet";

const item = "flex min-h-14 flex-1 flex-col items-center justify-center gap-0 text-xs text-muted";

// মেনু থেকে খোলা পাতাগুলো (নিচের নেভে "মেনু" সক্রিয় রাখতে)
const MENU_PAGES = [
  "/dashboard/bookmarks",
  "/dashboard/import",
  "/dashboard/library",
  "/dashboard/pages",
  "/dashboard/customize",
  "/dashboard/media",
  "/dashboard/stats",
  "/dashboard/shares",
  "/dashboard/comments",
  "/dashboard/backups",
  "/dashboard/settings",
];

// খাতা থেকে খোলা পাতাগুলো (নিচের নেভে "খাতা" সক্রিয় রাখতে)
const NOTEBOOK_PAGES = [
  "/dashboard/shelf",
  "/dashboard/trips",
  "/dashboard/review",
  "/dashboard/letters",
  "/dashboard/ideas",
  "/dashboard/inbox",
  "/dashboard/days",
];

/** <1024px: bottom-nav (৫ আইটেম: লাইব্রেরি, খাতা, ＋, দিনলিপি, মেনু) / উপরের সারি; editor-এ লুকানো (শুধু লেখা) */
export function TopNav() {
  const path = usePathname();
  const { openMenu, openNotebook } = useAdd();
  if (path.startsWith("/dashboard/posts/")) return null;
  // লাইব্রেরি শুধু ঠিক-মিলে (বাকি সব পেজ /dashboard/... — নইলে সবসময় active); অন্যগুলো সাব-পথসহ
  const isOn = (p: string) => (p === "/dashboard" ? path === p : path === p || path.startsWith(`${p}/`));
  // মেনুর ভেতরের পাতায় (সংগঠন, সেটিংস, মিডিয়া…) "মেনু" ট্যাব সক্রিয় থাকে; খোঁজ লাইব্রেরি থেকেও খোলে, তাই বাদ
  const link = (href: string, icon: IconName, label: string, also: string[] = []) => {
    const on = isOn(href) || also.some(isOn);
    return (
      <Link href={href} aria-current={on ? "page" : undefined} className={`${item} ${on ? "font-semibold text-accent-text" : ""}`}>
        <span className="flex h-7 w-14 items-center justify-center">
          <Icon name={icon} strokeWidth={on ? 2.4 : 1.8} />
        </span>
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
      <button
        type="button"
        onClick={openNotebook}
        aria-haspopup="dialog"
        aria-current={NOTEBOOK_PAGES.some(isOn) ? "page" : undefined}
        className={`${item} ${NOTEBOOK_PAGES.some(isOn) ? "font-semibold text-accent-text" : ""}`}
      >
        <span className="flex h-7 w-14 items-center justify-center">
          <Icon name="projects" strokeWidth={NOTEBOOK_PAGES.some(isOn) ? 2.4 : 1.8} />
        </span>
        <span className="max-w-full truncate px-1">{bn.nav.notebook}</span>
      </button>
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
      {link("/dashboard/menu", "menu", bn.nav.menu, MENU_PAGES)}
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
      <Link
        href="/dashboard/ideas"
        aria-label={bn.dashboard.ideasInbox}
        title={bn.dashboard.ideasInbox}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${collapsed ? "justify-center" : ""} ${
          path === "/dashboard/ideas" || path === "/dashboard/inbox" ? "bg-line font-semibold text-accent-text" : "text-muted hover:bg-line"
        }`}
      >
        <Icon name="idea" size={20} />
        {!collapsed && <span>{bn.dashboard.ideasInbox}</span>}
      </Link>
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
