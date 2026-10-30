"use client";

import { useLinkStatus } from "next/link";

/** <Link>-এর ভেতরে বসে: ট্যাপের পর নতুন পাতা আসা পর্যন্ত ছোট স্পিনার (ট্যাপ লেগেছে তা বোঝাতে — দ্বিতীয় ট্যাপ এড়াতে) */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`size-4 shrink-0 rounded-full border-2 border-line border-t-accent ${pending ? "animate-spin" : "invisible"}`}
    />
  );
}
