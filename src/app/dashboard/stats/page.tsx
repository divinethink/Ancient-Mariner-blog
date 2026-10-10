import Link from "next/link";
import { bn } from "@/i18n/bn";
import { StatsView } from "./StatsView";

export default function StatsPage() {
  return (
    <>
      <Link href="/dashboard/menu" className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {bn.dashboard.menu}
      </Link>
      <h1 className="mb-4 font-serif text-3xl font-bold">📊 {bn.stats.title}</h1>
      <StatsView />
    </>
  );
}
