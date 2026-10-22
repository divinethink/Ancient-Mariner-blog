import Link from "next/link";
import { bn } from "@/i18n/bn";

/** মেনুর ভেতরের সব পাতায় একই ফেরার লিংক (একটাই উপাদান — সব পাতা মিলে থাকে) */
export function MenuBack() {
  return (
    <Link href="/dashboard/menu" className="mb-3 inline-flex min-h-11 items-center gap-1 text-accent-text">
      <span aria-hidden="true">‹</span> {bn.dashboard.menu}
    </Link>
  );
}
