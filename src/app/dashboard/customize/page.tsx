import { MenuBack } from "../MenuBack";
import { bn } from "@/i18n/bn";
import { BuildStatus } from "../BuildStatus";
import { CustomizeForm } from "./CustomizeForm";

// P9a-২/৩: সাইট সাজান — মেনু, footer, sidebar, Home (Mockup §৭.১৭); design P9b
const TABS = ["menu", "footer", "sidebar", "home", "design"] as const;

export default async function CustomizePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const initialTab = TABS.find((x) => x === tab);
  return (
    <>
      <MenuBack />
      <h1 className="mb-6 font-serif text-3xl font-bold">{bn.customize.title}</h1>
      <CustomizeForm initialTab={initialTab} />
      <div className="mt-10">
        <BuildStatus />
      </div>
    </>
  );
}
