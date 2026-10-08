import { bn } from "@/i18n/bn";
import { PageList } from "./PageList";

export default function PagesPage() {
  return (
    <>
      <h1 className="mb-4 font-serif text-3xl font-bold">{bn.pages.title}</h1>
      <PageList />
    </>
  );
}
