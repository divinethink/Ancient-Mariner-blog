// Browser-এ Firebase Auth (lazy-load: শুধু /login ও /dashboard-এ আসে, public bundle-এ নয়)।
import type { Auth } from "firebase/auth";
import { localStore } from "@/data/localStore";
import { getFirebaseConfig } from "@/firebaseConfig";

let authPromise: Promise<Auth> | undefined;
function getAuthInstance(): Promise<Auth> {
  authPromise ??= (async () => {
    const [{ getApp, getApps, initializeApp }, { getAuth }] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
    ]);
    return getAuth(getApps().length ? getApp() : initializeApp(getFirebaseConfig()));
  })().catch((e) => {
    authPromise = undefined;
    throw e;
  });
  return authPromise;
}

const post = (url: string, body?: object) =>
  fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

export type SignInResult =
  | { status: "ok" }
  | { status: "not-owner" }
  | { status: "cancelled" }
  | { status: "error" };

export async function signInWithGoogle(): Promise<SignInResult> {
  try {
    const [auth, fb] = await Promise.all([getAuthInstance(), import("firebase/auth")]);
    const provider = new fb.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await fb.signInWithPopup(auth, provider);
    const res = await post("/api/auth/session", { idToken: await cred.user.getIdToken() });
    if (res.ok) return { status: "ok" };
    await fb.signOut(auth); // ভুল অ্যাকাউন্ট/ব্যর্থ — Firebase-সেশনও রাখা হয় না
    return res.status === 403 ? { status: "not-owner" } : { status: "error" };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return { status: "cancelled" };
    }
    return { status: "error" };
  }
}

/** সার্ভার-cookie মোছা — সফল না হলে throw */
export async function clearServerSession(): Promise<void> {
  const res = await post("/api/auth/logout");
  if (!res.ok) throw new Error("logout failed");
}

export type LogoutOptions = {
  /** editor (P2a) এগুলো জোগাবে: unsynced ড্রাফট থাকলে আগে sync, না হলে confirm */
  hasUnsynced?: () => Promise<boolean>;
  sync?: () => Promise<void>;
  confirmDiscard?: () => boolean;
};

/** Logout = cookie মোছা + Firebase signOut + লোকাল ডেটা মোছা (UI-পছন্দ localStorage-এ, থাকে) */
export async function logout(opts: LogoutOptions = {}): Promise<"done" | "aborted"> {
  if (opts.hasUnsynced && (await opts.hasUnsynced())) {
    await opts.sync?.().catch(() => undefined);
    if ((await opts.hasUnsynced()) && !(opts.confirmDiscard?.() ?? false)) return "aborted";
  }
  await clearServerSession(); // ব্যর্থ হলে এখানেই throw — লোকাল ডেটা অক্ষত
  try {
    const [auth, fb] = await Promise.all([getAuthInstance(), import("firebase/auth")]);
    await fb.signOut(auth);
  } catch {
    // Firebase init ব্যর্থ হলেও cookie মোছা হয়ে গেছে
  }
  await localStore.clearAll().catch(() => undefined);
  return "done";
}

/** Firebase user-এর অবস্থা শোনা; ফেরত = unsubscribe */
export async function watchAuth(cb: (signedIn: boolean) => void): Promise<() => void> {
  const [auth, fb] = await Promise.all([getAuthInstance(), import("firebase/auth")]);
  return fb.onAuthStateChanged(auth, (u) => cb(u !== null));
}
