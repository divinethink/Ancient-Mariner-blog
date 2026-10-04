import type { ReactNode } from "react";
import { AuthGate } from "@/auth/AuthGate";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
