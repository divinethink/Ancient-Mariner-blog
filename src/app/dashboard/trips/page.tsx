import { bn } from "@/i18n/bn";
import { MenuBack } from "../MenuBack";
import { TripView } from "./TripView";

export default function TripsPage() {
  return (
    <>
      <MenuBack />
      <h1 className="mb-2 font-serif text-3xl font-bold">{bn.trips.title}</h1>
      <p className="mb-4 text-sm text-muted">{bn.trips.intro}</p>
      <TripView />
    </>
  );
}
