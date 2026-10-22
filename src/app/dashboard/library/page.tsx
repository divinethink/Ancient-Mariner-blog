import { MenuBack } from "../MenuBack";
import { bn } from "@/i18n/bn";
import { MigrationPanel } from "./MigrationPanel";
import { TaxonomyManager } from "./TaxonomyManager";

export default function OrganizePage() {
  return (
    <>
      <MenuBack />
      <h1 className="mb-4 font-serif text-3xl font-bold">{bn.org.title}</h1>
      <TaxonomyManager />
      <div className="mt-10">
        <MigrationPanel />
      </div>
    </>
  );
}
