import { bn } from "@/i18n/bn";
import { DiaryView } from "./DiaryView";

export default function DiaryPage() {
  return (
    <>
      <h1 className="mb-4 font-serif text-3xl font-bold">{bn.diary.title}</h1>
      <DiaryView />
    </>
  );
}
