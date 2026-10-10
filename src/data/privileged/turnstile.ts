// Privileged allowlist ১ (Arch §২): Cloudflare Turnstile server-যাচাই — শুধু `POST /api/comment` থেকে। secret শুধু Worker secret।
// ফল: true = মানুষ, false = অবৈধ/মেয়াদোত্তীর্ণ/পুনর্ব্যবহৃত token। নেটওয়ার্ক/৫xx-ব্যর্থতা throw (route ৫০৩ দেয় — টোকেন ভুল বলে না)।
import { withRetry } from "../retry";

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(opts: { secret: string; token: string; ip?: string | null; fetchImpl?: typeof fetch }): Promise<boolean> {
  const { secret, token, ip, fetchImpl = fetch } = opts;
  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set("remoteip", ip);
  // siteverify token এক-ব্যবহারী: সফল/ব্যর্থ উত্তর পেলে আর retry নয়; শুধু নেটওয়ার্ক/৫xx-এ retry (দুই বার)
  return withRetry(
    async (signal) => {
      const res = await fetchImpl(TURNSTILE_VERIFY_URL, { method: "POST", body: form, signal });
      if (res.status >= 500) throw new Error(`turnstile ${res.status}`);
      const j = (await res.json().catch(() => null)) as { success?: boolean } | null;
      return j?.success === true;
    },
    { retries: 2, timeoutMs: 5000 },
  );
}
