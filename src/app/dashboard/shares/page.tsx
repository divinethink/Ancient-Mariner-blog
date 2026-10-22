import { MenuBack } from "../MenuBack";
import { bn } from "@/i18n/bn";
import { SharesView } from "./SharesView";

export default function SharesPage() {
  return (
    <>
      <MenuBack />
      <h1 className="mb-2 font-serif text-3xl font-bold">{bn.shareLink.title}</h1>
      <p className="mb-6 text-muted">{bn.shareLink.intro}</p>
      <SharesView />
    </>
  );
}
