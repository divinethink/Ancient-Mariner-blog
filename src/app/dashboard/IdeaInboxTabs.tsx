import Link from "next/link";
import { bn } from "@/i18n/bn";

const tab = "flex min-h-11 flex-1 items-center justify-center rounded-full text-base";

/** মেনুর 'আইডিয়া ও ইনবক্স' স্ক্রিনের দুই ট্যাব (Mockup §৭.১৩); প্রতিটা আলাদা route — back/deep-link কাজ করে */
export function IdeaInboxTabs({ active }: { active: "ideas" | "inbox" }) {
  const t = bn.ideas;
  const cls = (on: boolean) =>
    `${tab} ${on ? "bg-btn-bg font-semibold text-btn-tx" : "border border-line text-muted"}`;
  return (
    <nav aria-label={t.tabsLabel} className="mb-4 flex gap-2">
      <Link
        href="/dashboard/ideas"
        aria-current={active === "ideas" ? "page" : undefined}
        className={cls(active === "ideas")}
      >
        {t.tabIdeas}
      </Link>
      <Link
        href="/dashboard/inbox"
        aria-current={active === "inbox" ? "page" : undefined}
        className={cls(active === "inbox")}
      >
        {t.tabInbox}
      </Link>
    </nav>
  );
}
