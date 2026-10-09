import type { Metadata } from "next";
import { bn } from "@/i18n/bn";

// Service Worker-এর offline fallback (static; build-public.mjs এটি assets-এ offline.html হিসেবে কপি করে)
export const metadata: Metadata = { title: bn.offline.title, robots: { index: false } };

export default function OfflinePage() {
  return (
    <>
      <h1 className="font-serif text-3xl font-bold">{bn.offline.title}</h1>
      <p className="mt-2 text-muted">{bn.offline.body}</p>
      {/* সাধারণ <a>: SW-এর cache-করা পেজে সরাসরি নেভিগেশন */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="mt-4 inline-flex min-h-11 items-center text-accent-text underline">
        {bn.offline.home}
      </a>
    </>
  );
}
