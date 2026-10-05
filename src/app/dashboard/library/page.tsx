import Link from "next/link";
import { bn } from "@/i18n/bn";
import { MigrationPanel } from "./MigrationPanel";
import { TaxonomyManager } from "./TaxonomyManager";

export default function OrganizePage() {
  return (
    <>
      <Link href="/dashboard" className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {bn.dashboard.library}
      </Link>
      <h1 className="mb-4 font-serif text-3xl font-bold">{bn.org.title}</h1>
      <TaxonomyManager />
      <div className="mt-10">
        <MigrationPanel />
      </div>
    </>
  );
}
