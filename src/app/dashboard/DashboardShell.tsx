"use client";

// Dashboard layout (Arch §১৩): <1024px = আগের (bottom-nav/উপরের সারি, max-w-3xl); ≥1024px = বাঁ panel (২৪০↔৭২px)।
// editor-এ ≥1024px-এ কনটেন্ট-এলাকা প্রস্থ-সীমাহীন (editor নিজের কলাম/inspector সামলায়)।
import { usePathname } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { readNavCollapsed, saveNavCollapsed } from "@/data/comfortStore";
import { AddProvider } from "./AddSheet";
import { SidePanel, TopNav } from "./DashboardNav";

export function DashboardShell({ children }: { children: ReactNode }) {
  // AuthGate-এর ভেতরে (client-এ mount-এর পর) বলে lazy-read hydration-নিরাপদ
  const [collapsed, setCollapsed] = useState(readNavCollapsed);
  const inEditor = usePathname().startsWith("/dashboard/posts/");
  const toggle = () => {
    saveNavCollapsed(!collapsed);
    setCollapsed(!collapsed);
  };
  return (
    <AddProvider>
      <div className="dash-shell lg:pl-[var(--nav-w)]" style={{ "--nav-w": collapsed ? "72px" : "240px" } as CSSProperties}>
        <SidePanel collapsed={collapsed} onToggle={toggle} />
        <div className={`mx-auto max-w-3xl p-6 ${inEditor ? "lg:max-w-none" : ""}`}>
          <TopNav />
          <div className="pb-24 md:pb-0">{children}</div>
        </div>
      </div>
    </AddProvider>
  );
}
