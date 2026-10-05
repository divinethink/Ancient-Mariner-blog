import { bn } from "@/i18n/bn";
import { LibraryHome } from "./LibraryHome";

export default function DashboardPage() {
  return (
    <>
      <h1 className="mb-4 font-serif text-3xl font-bold">{bn.dashboard.library}</h1>
      <LibraryHome />
    </>
  );
}
