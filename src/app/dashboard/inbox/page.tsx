import { bn } from "@/i18n/bn";
import { IdeaInboxTabs } from "../IdeaInboxTabs";
import { InboxList } from "../InboxList";

export default function InboxPage() {
  return (
    <>
      <h1 className="mb-4 font-serif text-3xl font-bold">{bn.dashboard.ideasInbox}</h1>
      <IdeaInboxTabs active="inbox" />
      <InboxList />
    </>
  );
}
