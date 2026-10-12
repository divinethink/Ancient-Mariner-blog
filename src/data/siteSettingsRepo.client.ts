// পথ ক (owner-CSR): Firebase Web SDK + owner ID token; rules প্রযোজ্য (siteSettings: public-read, owner-write)।
// শুধু dashboard থেকে dynamic import (public bundle-এ Firebase নয়)।
import { doc, getDoc, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";
import {
  SiteSettingsInputSchema,
  parseSiteSettings,
  type SiteSettings,
  type SiteSettingsRepo,
} from "@/data/siteSettingsRepo";
import { SETTINGS_DOC_ID, SETTINGS_SCHEMA_VERSION } from "@/lib/siteSettings";

export function createSiteSettingsRepoClient(db: Firestore, ownerUid: string): SiteSettingsRepo {
  const ref = doc(db, "siteSettings", SETTINGS_DOC_ID);
  return {
    async get(): Promise<SiteSettings> {
      const snap = await getDoc(ref);
      return parseSiteSettings(snap.exists() ? snap.data() : undefined);
    },
    async save(input: SiteSettings): Promise<SiteSettings> {
      const parsed = SiteSettingsInputSchema.parse(input);
      // ঐচ্ছিক ফিল্ড undefined হলে বাদ — Firestore `undefined` মান প্রত্যাখ্যান করে
      const data = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined)) as SiteSettings;
      // merge: পরের phase-এর ফিল্ড (menu/layout/…) অক্ষত; `createdAt` শুধু প্রথম লেখায়
      await runTransaction(db, async (tx) => {
        const exists = (await tx.get(ref)).exists();
        tx.set(
          ref,
          {
            ...data,
            ownerUid,
            schemaVersion: SETTINGS_SCHEMA_VERSION,
            updatedAt: serverTimestamp(),
            ...(exists ? {} : { createdAt: serverTimestamp() }),
          },
          { merge: true },
        );
      });
      return data;
    },
  };
}
