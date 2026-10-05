import Link from "next/link";
import { bn } from "@/i18n/bn";
import { BuildStatus } from "../BuildStatus";

// সাইট-সেটিং সম্পাদনা UI P2c-তে; এখন শুধু পাবলিক সাইটের build-অবস্থা/rebuild (P2a-৩খ)
export default function SettingsPage() {
  return (
    <>
      <Link href="/dashboard/menu" className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {bn.dashboard.menu}
      </Link>
      <h1 className="mb-4 font-serif text-3xl font-bold">{bn.settings.title}</h1>
      <p className="mb-6 text-muted">{bn.settings.soon}</p>
      <BuildStatus />
    </>
  );
}
