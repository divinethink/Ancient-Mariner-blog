import type { ReactNode } from "react";
import { AuthGate } from "@/auth/AuthGate";
import { DashboardNav } from "./DashboardNav";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <DashboardNav />
      <div className="pb-24 md:pb-0">{children}</div>
    </AuthGate>
  );
}
