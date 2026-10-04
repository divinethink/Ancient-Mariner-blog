import type { ReactNode } from "react";

export const metadata = { title: "ব্লগ — P0a যাচাই", robots: { index: false } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 24 }}>{children}</body>
    </html>
  );
}
