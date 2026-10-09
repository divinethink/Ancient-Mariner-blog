import { bn } from "@/i18n/bn";
import { MediaManager } from "./MediaManager";

export default function MediaPage() {
  return (
    <>
      <h1 className="mb-2 font-serif text-3xl font-bold">{bn.media.title}</h1>
      <p className="mb-4 text-sm text-muted">{bn.media.intro}</p>
      <MediaManager />
    </>
  );
}
