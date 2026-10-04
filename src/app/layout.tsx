import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Ancient Mariner", robots: { index: false } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 24 }}>{children}</body>
    </html>
  );
}
