import { bn } from "@/i18n/bn";
import { MenuBack } from "../MenuBack";
import { ReviewView } from "./ReviewView";

export default function ReviewPage() {
  return (
    <>
      <MenuBack />
      <h1 className="mb-2 font-serif text-3xl font-bold">{bn.review.title}</h1>
      <p className="mb-4 text-sm text-muted">{bn.review.intro}</p>
      <ReviewView />
    </>
  );
}
