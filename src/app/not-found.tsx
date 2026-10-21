import Link from "next/link";
import { LiveNotFound } from "@/components/public/LiveNotFound";
import { bn } from "@/i18n/bn";

// ব্র্যান্ডেড 404 (static; `build-public.mjs` এটি assets-এ 404.html হিসেবে কপি করে)
export default function NotFound() {
  // নতুন-প্রকাশ তাৎক্ষণিক: `/blog/<slug>` মিস হলে LiveNotFound লাইভ-লেখা দেখায়; নইলে নিচের 404 অপরিবর্তিত
  return (
    <LiveNotFound>
      <h1 className="font-serif text-3xl font-bold">{bn.notFound.title}</h1>
      <p className="mt-2 text-muted">{bn.notFound.body}</p>
      <Link href="/" prefetch={false} className="mt-4 inline-flex min-h-11 items-center text-accent-text underline">
        {bn.notFound.home}
      </Link>
      <Link href="/search" prefetch={false} className="mt-4 ms-4 inline-flex min-h-11 items-center text-accent-text underline">
        {bn.notFound.search}
      </Link>
    </LiveNotFound>
  );
}
