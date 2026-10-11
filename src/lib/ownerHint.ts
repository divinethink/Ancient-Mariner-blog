// "আমি owner" ইঙ্গিত (UI-সুবিধা মাত্র): পাবলিক পেজে "ড্যাশবোর্ড" লিংক দেখানোর জন্য localStorage-এ একটা চিহ্ন।
// নিরাপত্তা নয় — ড্যাশবোর্ড নিজের auth-এ সুরক্ষিত; চিহ্ন জাল হলে শুধু একটা লিংক দেখায়। সব ব্যর্থতা নীরবে উপেক্ষিত।
export const OWNER_HINT_KEY = "am-owner-hint";

export function setOwnerHint(on: boolean): void {
  try {
    if (on) localStorage.setItem(OWNER_HINT_KEY, "1");
    else localStorage.removeItem(OWNER_HINT_KEY);
  } catch {
    // private window/blocked storage: লিংক শুধু দেখাবে না
  }
}

export function hasOwnerHint(): boolean {
  try {
    return localStorage.getItem(OWNER_HINT_KEY) === "1";
  } catch {
    return false;
  }
}
