import Link from "next/link";
import { bn } from "@/i18n/bn";
import { SharesView } from "./SharesView";

export default function SharesPage() {
  return (
    <>
      <Link href="/dashboard/menu" className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {bn.dashboard.menu}
      </Link>
      <h1 className="mb-2 font-serif text-3xl font-bold">🔗 {bn.shareLink.title}</h1>
      <p className="mb-6 text-muted">{bn.shareLink.intro}</p>
      <SharesView />
    </>
  );
}
