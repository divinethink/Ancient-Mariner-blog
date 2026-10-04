// Firebase Web config (browser-key secret নয়; সুরক্ষা = API restriction + Rules, Arch §১৪.১০)।
// `NEXT_PUBLIC_*` build-সময়ে inline হয় — সরাসরি `process.env.NAME` লিখতে হয়।
export function getFirebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) throw new Error("Firebase browser config মিসিং");
  return { apiKey, projectId, authDomain: `${projectId}.firebaseapp.com` };
}
