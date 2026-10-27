import { MenuBack } from "../MenuBack";
import { bn } from "@/i18n/bn";
import { IdeaInboxTabs } from "../IdeaInboxTabs";
import { IdeaList } from "../IdeaList";

export default function IdeasPage() {
  return (
    <>
      <MenuBack to="library" />
      <h1 className="mb-1 font-serif text-3xl font-bold">{bn.dashboard.ideasInbox}</h1>
      <p className="mb-5 text-muted">{bn.ideas.pageHint}</p>
      <IdeaInboxTabs active="ideas" />
      <IdeaList />
    </>
  );
}
