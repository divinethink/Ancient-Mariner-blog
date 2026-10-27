import Link from "next/link";
import { Icon } from "@/components/icons";
import { bn } from "@/i18n/bn";

const tab = "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full text-base transition-colors";

/** মেনুর 'আইডিয়া ও ইনবক্স' স্ক্রিনের দুই ট্যাব (Mockup §৭.১৩); প্রতিটা আলাদা route — back/deep-link কাজ করে */
export function IdeaInboxTabs({ active }: { active: "ideas" | "inbox" }) {
  const t = bn.ideas;
  const cls = (on: boolean) =>
    `${tab} ${on ? "bg-btn-bg font-semibold text-btn-tx shadow-sm" : "text-muted hover:bg-line"}`;
  return (
    <nav aria-label={t.tabsLabel} className="mb-5 flex gap-1 rounded-full border border-line bg-surface p-1">
      <Link
        href="/dashboard/ideas"
        aria-current={active === "ideas" ? "page" : undefined}
        className={cls(active === "ideas")}
      >
        <Icon name="idea" size={18} />
        {t.tabIdeas}
      </Link>
      <Link
        href="/dashboard/inbox"
        aria-current={active === "inbox" ? "page" : undefined}
        className={cls(active === "inbox")}
      >
        <Icon name="inbox" size={18} />
        {t.tabInbox}
      </Link>
    </nav>
  );
}
