// ব্রাউজারে owner-এর Firestore + uid জোগান (lazy; শুধু dashboard)। নতুন repo-wire (settings, backups…) এটি reuse করে।
import type { Firestore } from "firebase/firestore";
import { getFirebaseConfig } from "@/firebaseConfig";

let p: Promise<{ db: Firestore; uid: string }> | undefined;

export function getOwnerDb(): Promise<{ db: Firestore; uid: string }> {
  p ??= (async () => {
    const [{ getApp, getApps, initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]);
    const app = getApps().length ? getApp() : initializeApp(getFirebaseConfig());
    const uid = getAuth(app).currentUser?.uid;
    if (!uid) throw new Error("সাইন-ইন নেই");
    return { db: getFirestore(app), uid };
  })().catch((e) => {
    p = undefined; // পরের চেষ্টায় আবার
    throw e;
  });
  return p;
}
