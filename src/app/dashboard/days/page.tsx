import { bn } from "@/i18n/bn";
import { MenuBack } from "../MenuBack";
import { DaysView } from "./DaysView";

export default function DaysPage() {
  return (
    <>
      <MenuBack to="library" />
      <h1 className="mb-2 font-serif text-3xl font-bold">{bn.days.title}</h1>
      <p className="mb-4 text-sm text-muted">{bn.days.intro}</p>
      <DaysView />
    </>
  );
}
