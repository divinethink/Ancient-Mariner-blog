import type { ReactNode } from "react";
import { AuthGate } from "@/auth/AuthGate";
import { DashboardShell } from "./DashboardShell";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <DashboardShell>{children}</DashboardShell>
    </AuthGate>
  );
}
