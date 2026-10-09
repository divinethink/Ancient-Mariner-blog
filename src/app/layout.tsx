import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { bn } from "@/i18n/bn";
import { verificationToken } from "@/lib/seo";
import { SwRegister } from "./SwRegister";
import "./globals.css";

const gsc = verificationToken(process.env.GOOGLE_SITE_VERIFICATION);

// লঞ্চ-যাচাইয়ের আগে সর্বত্র noindex (Google-ইনডেক্স টগল P2c-তে)
export const metadata: Metadata = {
  title: bn.siteName,
  robots: { index: false },
  manifest: "/manifest.json",
  // Search Console (P6-৩ক): build-সময়ের env; না থাকলে/অবৈধ হলে meta বসে না
  ...(gsc ? { verification: { google: gsc } } : {}),
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#faf9f5" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- ইচ্ছাকৃত blocking: FOUC এড়াতে (Arch §১১) */}
        <script src="/theme-init.js" />
      </head>
      <body>
        <SwRegister />
        <a className="skip-link" href="#main">
          {bn.skipToContent}
        </a>
        <main id="main" className="mx-auto max-w-3xl p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
