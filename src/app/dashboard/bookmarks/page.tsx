import { MenuBack } from "../MenuBack";
import { bn } from "@/i18n/bn";
import { BookmarksView } from "./BookmarksView";

export default function BookmarksPage() {
  return (
    <>
      <MenuBack />
      <h1 className="mb-4 font-serif text-3xl font-bold">{bn.dashboard.bookmarks}</h1>
      <BookmarksView />
    </>
  );
}
