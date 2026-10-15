"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { bn } from "@/i18n/bn";
import { hasOwnerHint } from "@/lib/ownerHint";

const subscribe = () => () => undefined;

/** শুধু owner-এর ব্রাউজারে (লগইনের চিহ্ন থাকলে, ফুটারের ড্যাশবোর্ড লিংকের একই ব্যবস্থা) লেখার শেষে, নিচে ডানদিকে ছোট ✏️ — এই লেখার এডিটরে যায়।
 * চিহ্নটা UI-ইঙ্গিত মাত্র; আসল সুরক্ষা middleware ও Firestore rules-এ। static HTML-এ কিছু থাকে না। */
export function OwnerEditButton({ postId }: { postId: string }) {
  const on = useSyncExternalStore(subscribe, hasOwnerHint, () => false);
  if (!on) return null;
  return (
    <div className="mt-3 flex justify-end">
      <Link
        href={`/dashboard/posts/${postId}/edit`}
        prefetch={false}
        aria-label={bn.public.ownerEditPost}
        title={bn.public.ownerEditPost}
        className="inline-flex size-9 items-center justify-center rounded-full border border-line text-base opacity-70 hover:opacity-100"
      >
        ✏️
      </Link>
    </div>
  );
}
