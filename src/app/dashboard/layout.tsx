import type { ReactNode } from "react";
import { AuthGate } from "@/auth/AuthGate";
import { AppLockGate } from "./AppLockGate";
import { DashboardShell } from "./DashboardShell";
import { SiteSettingsProvider } from "./SiteSettingsProvider";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <SiteSettingsProvider>
        <AppLockGate>
          <DashboardShell>{children}</DashboardShell>
        </AppLockGate>
      </SiteSettingsProvider>
    </AuthGate>
  );
}
