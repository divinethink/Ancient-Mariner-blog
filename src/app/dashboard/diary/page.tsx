import Link from "next/link";
import { Icon } from "@/components/icons";
import { bn } from "@/i18n/bn";
import { DiaryView } from "./DiaryView";

export default function DiaryPage() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-bold">{bn.diary.title}</h1>
        {/* পূর্ণ-লেখা খোঁজ, শুধু দিনলিপির লেখায় সীমাবদ্ধ (?type=diary) */}
        <Link
          href="/dashboard/search?type=diary"
          aria-label={bn.diary.search}
          title={bn.diary.search}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line"
        >
          <Icon name="search" size={20} />
        </Link>
      </div>
      <DiaryView />
    </>
  );
}
