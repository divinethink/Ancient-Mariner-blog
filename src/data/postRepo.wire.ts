// ব্রাউজারে owner-এর PostRepo জোগান — Firebase lazy-load (শুধু dashboard; public bundle-এ নয়)।
import type { PostRepo } from "@/data/postRepo";
import { getFirebaseConfig } from "@/firebaseConfig";

let repoPromise: Promise<PostRepo> | undefined;

export function getPostRepo(): Promise<PostRepo> {
  repoPromise ??= (async () => {
    const [{ getApp, getApps, initializeApp }, { getAuth }, { getFirestore }, { createPostRepoClient }] =
      await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
        import("firebase/firestore"),
        import("@/data/postRepo.client"),
      ]);
    const app = getApps().length ? getApp() : initializeApp(getFirebaseConfig());
    const uid = getAuth(app).currentUser?.uid;
    if (!uid) throw new Error("সাইন-ইন নেই");
    return createPostRepoClient(getFirestore(app), uid);
  })().catch((e) => {
    repoPromise = undefined; // পরের চেষ্টায় আবার
    throw e;
  });
  return repoPromise;
}
