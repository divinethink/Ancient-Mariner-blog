import { Section } from "@/components/ui/Section";
import { MenuBack } from "../MenuBack";
import { bn } from "@/i18n/bn";
import { AutoBackupPanel } from "./AutoBackupPanel";
import { BackupPanel } from "./BackupPanel";
import { RestorePanel } from "./RestorePanel";
import { TextExportPanel } from "./TextExportPanel";

export default function BackupsPage() {
  return (
    <>
      <MenuBack />
      <h1 className="mb-2 font-serif text-3xl font-bold">{bn.backup.title}</h1>
      <p className="mb-6 text-muted">{bn.backup.pageIntro}</p>
      <AutoBackupPanel />
      <div className="space-y-3">
        <Section title={bn.backup.manualTitle} summary={bn.backup.sum.manual}>
          <BackupPanel />
        </Section>
        <Section title={bn.backup.textExport.title} summary={bn.backup.sum.text}>
          <TextExportPanel />
        </Section>
        <Section title={bn.backup.restore.title} summary={bn.backup.sum.restore}>
          <RestorePanel />
        </Section>
      </div>
    </>
  );
}
