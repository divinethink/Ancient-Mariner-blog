import { MenuBack } from "../MenuBack";
import { bn } from "@/i18n/bn";
import { IdeaInboxTabs } from "../IdeaInboxTabs";
import { IdeaList } from "../IdeaList";

export default function IdeasPage() {
  return (
    <>
      <MenuBack />
      <h1 className="mb-4 font-serif text-3xl font-bold">{bn.dashboard.ideasInbox}</h1>
      <IdeaInboxTabs active="ideas" />
      <IdeaList />
    </>
  );
}
