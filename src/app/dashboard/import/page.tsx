import { MenuBack } from "../MenuBack";
import { bn } from "@/i18n/bn";
import { ImportPanel } from "./ImportPanel";

export default function ImportPage() {
  return (
    <>
      <MenuBack />
      <h1 className="mb-2 font-serif text-3xl font-bold">{bn.importWp.title}</h1>
      <p className="mb-6 text-muted">{bn.importWp.intro}</p>
      <ImportPanel />
    </>
  );
}
