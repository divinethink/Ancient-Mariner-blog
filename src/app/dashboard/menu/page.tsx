import { bn } from "@/i18n/bn";
import { LogoutButton } from "../LogoutButton";
import { MenuGroup, MenuRow } from "./MenuRow";
import { ThemePicker } from "./ThemePicker";

// ধাপ ১: মেনু ৪ গ্রুপে (লেখা · সাইট · অন্তর্দৃষ্টি · সিস্টেম); থিম-গ্রিড শীর্ষে; "প্রজেক্ট" এখন নেভে (Mockup §৭.৭)
export default function MenuPage() {
  return (
    <>
      <h1 className="mb-4 font-serif text-3xl font-bold">{bn.dashboard.menu}</h1>
      <ThemePicker />
      <MenuGroup title={bn.dashboard.groupWrite}>
        <MenuRow href="/dashboard/search" icon="search" label={bn.search.navLabel} />
        <MenuRow href="/dashboard/bookmarks" icon="bookmark" label={bn.dashboard.bookmarks} />
        <MenuRow href="/dashboard/import" icon="import" label={bn.dashboard.importWp} />
        <MenuRow href="/dashboard/library" icon="organize" label={bn.dashboard.organize} />
      </MenuGroup>
      <MenuGroup title={bn.dashboard.groupSite}>
        <MenuRow href="/" icon="globe" label={bn.dashboard.viewSite} external />
        <MenuRow href="/dashboard/pages" icon="page" label={bn.dashboard.pages} />
        <MenuRow href="/dashboard/customize" icon="palette" label={bn.customize.menuLink} />
        <MenuRow href="/dashboard/media" icon="image" label={bn.dashboard.media} />
      </MenuGroup>
      <MenuGroup title={bn.dashboard.groupInsight}>
        <MenuRow href="/dashboard/stats" icon="chart" label={bn.dashboard.stats} />
        <MenuRow href="/dashboard/shares" icon="link" label={bn.shareLink.menu} />
        <MenuRow href="/dashboard/comments" icon="comment" label={bn.comments.menu} />
      </MenuGroup>
      <MenuGroup title={bn.dashboard.groupSystem}>
        <MenuRow href="/dashboard/backups" icon="backup" label={bn.backup.title} />
        <MenuRow href="/dashboard/settings" icon="settings" label={bn.dashboard.settings} />
      </MenuGroup>
      <LogoutButton />
    </>
  );
}
