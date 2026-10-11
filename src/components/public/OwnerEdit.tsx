"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { bn } from "@/i18n/bn";
import { hasOwnerHint } from "@/lib/ownerHint";

const subscribe = () => () => undefined;

/** শুধু owner-এর ব্রাউজারে ✎ — সাইডবারের নাম-বদলের পাতায় নেয়; অন্য পাঠকের জন্য কিছুই আঁকে না (static HTML-এও নেই) */
export function OwnerEdit() {
  const on = useSyncExternalStore(subscribe, hasOwnerHint, () => false);
  return on ? (
    <Link href="/dashboard/customize?tab=sidebar" prefetch={false} aria-label={bn.public.editWidgetTitle} title={bn.public.editWidgetTitle} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-accent-text">
      ✎
    </Link>
  ) : null;
}
