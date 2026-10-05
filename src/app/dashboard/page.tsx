import Link from "next/link";
import { bn } from "@/i18n/bn";
import { LibraryHome } from "./LibraryHome";

export default function DashboardPage() {
  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <h1 className="flex-1 font-serif text-3xl font-bold">{bn.dashboard.library}</h1>
        <Link
          href="/dashboard/library"
          className="flex min-h-11 items-center rounded-full border border-line px-4 text-sm"
        >
          {bn.org.openFromLibrary}
        </Link>
      </div>
      <LibraryHome />
    </>
  );
}
