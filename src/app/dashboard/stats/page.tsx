import { MenuBack } from "../MenuBack";
import { bn } from "@/i18n/bn";
import { StatsView } from "./StatsView";

export default function StatsPage() {
  return (
    <>
      <MenuBack />
      <h1 className="mb-4 font-serif text-3xl font-bold">{bn.stats.title}</h1>
      <StatsView />
    </>
  );
}
