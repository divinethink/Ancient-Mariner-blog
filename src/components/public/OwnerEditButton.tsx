"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { bn } from "@/i18n/bn";
import { hasOwnerHint } from "@/lib/ownerHint";

const subscribe = () => () => undefined;

/** শুধু owner-এর ব্রাউজারে (লগইনের চিহ্ন থাকলে, ফুটারের ড্যাশবোর্ড লিংকের একই ব্যবস্থা) এই লেখার এডিটরে যাওয়ার ✏️ বাটন।
 * চিহ্নটা UI-ইঙ্গিত মাত্র; আসল সুরক্ষা middleware ও Firestore rules-এ। static HTML-এ কিছু থাকে না। */
export function OwnerEditButton({ postId }: { postId: string }) {
  const on = useSyncExternalStore(subscribe, hasOwnerHint, () => false);
  if (!on) return null;
  return (
    <Link
      href={`/dashboard/posts/${postId}/edit`}
      prefetch={false}
      aria-label={bn.public.ownerEditPost}
      title={bn.public.ownerEditPost}
      className="fixed start-4 z-20 inline-flex size-12 items-center justify-center rounded-full border border-line bg-surface text-xl shadow-lg"
      style={{ bottom: "max(16px, env(safe-area-inset-bottom, 0px))" }}
    >
      ✏️
    </Link>
  );
}
