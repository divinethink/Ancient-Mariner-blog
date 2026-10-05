import Link from "next/link";
import { bn } from "@/i18n/bn";
import { BackupPanel } from "./BackupPanel";

export default function BackupsPage() {
  return (
    <>
      <Link href="/dashboard/menu" className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {bn.dashboard.menu}
      </Link>
      <h1 className="mb-2 font-serif text-3xl font-bold">☁️ {bn.backup.title}</h1>
      <p className="mb-6 text-muted">{bn.backup.intro}</p>
      <BackupPanel />
    </>
  );
}
