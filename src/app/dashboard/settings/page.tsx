import Link from "next/link";
import { bn } from "@/i18n/bn";

// P2a-৩ স্ক্যাফোল্ড; সম্পাদনা UI P2c-তে, build-অবস্থা/rebuild বোতাম P2a-৩খ-তে
export default function SettingsPage() {
  return (
    <>
      <Link href="/dashboard/menu" className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {bn.dashboard.menu}
      </Link>
      <h1 className="mb-4 font-serif text-3xl font-bold">{bn.settings.title}</h1>
      <p className="text-muted">{bn.settings.soon}</p>
    </>
  );
}
