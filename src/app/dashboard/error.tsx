"use client";

import Link from "next/link";
import { bn } from "@/i18n/bn";

// Dashboard-এর Error Boundary: stack trace দেখানো হয় না; ফেরার পথ = লাইব্রেরি
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <h1 className="font-serif text-2xl font-bold">{bn.error.title}</h1>
      <p className="text-muted">{bn.error.body}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="min-h-11 rounded-lg bg-btn-bg px-4 text-btn-tx">
          {bn.error.retry}
        </button>
        <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4">
          {bn.error.backToLibrary}
        </Link>
      </div>
    </>
  );
}
