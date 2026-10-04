"use client";

import { bn } from "@/i18n/bn";

// Error Boundary: stack trace ইউজারকে দেখানো হয় না (Arch §৩ Logging)
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <h1 className="font-serif text-2xl font-bold">{bn.error.title}</h1>
      <p className="text-muted">{bn.error.body}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 min-h-11 rounded-lg bg-btn-bg px-4 text-btn-tx"
      >
        {bn.error.retry}
      </button>
    </>
  );
}
