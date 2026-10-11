"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { bn } from "@/i18n/bn";
import { hasOwnerHint } from "@/lib/ownerHint";

const subscribe = () => () => undefined;

/** শুধু owner-এর ব্রাউজারে (লগইনের চিহ্ন থাকলে) "ড্যাশবোর্ড" লিংক; অন্য পাঠকের জন্য কিছুই আঁকে না */
export function OwnerLink({ className }: { className: string }) {
  // server/hydration = false (static HTML-এ কিছু নেই); client-এ চিহ্ন থাকলে true
  const on = useSyncExternalStore(subscribe, hasOwnerHint, () => false);
  return on ? (
    <Link href="/dashboard" prefetch={false} className={className}>
      ✎ {bn.public.ownerDashboard}
    </Link>
  ) : null;
}
