"use client";

// Dashboard layout (Arch §১৩): <1024px = আগের (bottom-nav/উপরের সারি, max-w-3xl); ≥1024px = বাঁ panel (২৪০↔৭২px)।
// editor-এ ≥1024px-এ কনটেন্ট-এলাকা প্রস্থ-সীমাহীন (editor নিজের কলাম/inspector সামলায়)।
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { readNavCollapsed, saveNavCollapsed } from "@/data/comfortStore";
import { AddProvider } from "./AddSheet";
import { SidePanel, TopNav } from "./DashboardNav";
import { useMinWidth } from "./useMinWidth";

// Command palette: প্রথমবার খোলার আগে chunk-ই নামে না (P7a-২)
const CommandPalette = dynamic(() => import("./CommandPalette"), { ssr: false });

export function DashboardShell({ children }: { children: ReactNode }) {
  // AuthGate-এর ভেতরে (client-এ mount-এর পর) বলে lazy-read hydration-নিরাপদ
  const [collapsed, setCollapsed] = useState(readNavCollapsed);
  const path = usePathname();
  const inEditor = path.startsWith("/dashboard/posts/");
  const desktop = useMinWidth(1024);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Ctrl/⌘+K — editor-এ নয় (editor-এর নিজস্ব শর্টকাটের সাথে সংঘাত এড়াতে; সেখানে 🔍 বোতাম আছে)
  useEffect(() => {
    if (!desktop || inEditor) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [desktop, inEditor]);
  const toggle = () => {
    saveNavCollapsed(!collapsed);
    setCollapsed(!collapsed);
  };
  return (
    <AddProvider>
      <div
        className="dash-shell lg:pl-[var(--nav-w)]"
        style={{ "--nav-w": collapsed ? "72px" : "240px" } as CSSProperties}
      >
        <SidePanel collapsed={collapsed} onToggle={toggle} onSearch={() => setPaletteOpen(true)} />
        <div
          className={`mx-auto max-w-3xl p-6 ${inEditor ? "lg:max-w-none" : path === "/dashboard" ? "lg:max-w-6xl" : ""}`}
        >
          <TopNav />
          <div className="pb-24 md:pb-0">{children}</div>
        </div>
      </div>
      {desktop && paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </AddProvider>
  );
}
