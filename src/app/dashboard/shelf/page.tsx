import Link from "next/link";
import { bn } from "@/i18n/bn";
import { MenuBack } from "../MenuBack";
import { ShelfView } from "./ShelfView";

export default function ShelfPage() {
  return (
    <>
      <MenuBack />
      <h1 className="mb-2 font-serif text-3xl font-bold">{bn.shelf.title}</h1>
      <p className="mb-1 text-sm text-muted">{bn.shelf.intro}</p>
      <p className="mb-2 text-sm text-muted">{bn.shelf.intro2}</p>
      <Link href="/dashboard/shelf/quotes" className="mb-4 inline-flex min-h-11 items-center text-accent-text underline">
        {bn.shelf.quotesLink}
      </Link>
      <ShelfView />
    </>
  );
}
