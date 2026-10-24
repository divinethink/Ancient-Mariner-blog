import Link from "next/link";
import { bn } from "@/i18n/bn";

/** মেনু/খাতার ভেতরের সব পাতায় একই ফেরার লিংক (একটাই উপাদান — সব পাতা মিলে থাকে); to="library" = খাতা-শিট থেকে খোলা পাতা */
export function MenuBack({ to = "menu" }: { to?: "menu" | "library" }) {
  const lib = to === "library";
  return (
    <Link href={lib ? "/dashboard" : "/dashboard/menu"} className="mb-3 inline-flex min-h-11 items-center gap-1 text-accent-text">
      <span aria-hidden="true">‹</span> {lib ? bn.dashboard.library : bn.dashboard.menu}
    </Link>
  );
}
