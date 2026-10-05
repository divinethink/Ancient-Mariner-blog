import type { ReactNode } from "react";
import { AuthGate } from "@/auth/AuthGate";
import { DashboardShell } from "./DashboardShell";
import { SiteSettingsProvider } from "./SiteSettingsProvider";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <SiteSettingsProvider>
        <DashboardShell>{children}</DashboardShell>
      </SiteSettingsProvider>
    </AuthGate>
  );
}
