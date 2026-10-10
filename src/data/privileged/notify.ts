// Privileged allowlist ৮ (P11b-২): নতুন মন্তব্যের ইমেইল-খবর (Resend REST) — শুধু মালিককে; ব্যর্থ হলে নীরবে false (মন্তব্য-জমা কখনো আটকায় না)।
// নিজের domain ছাড়া Resend শুধু অ্যাকাউন্টের নিজের ইমেইলে পাঠায় (owner-সিদ্ধান্ত ২০২৬-১০-১০: মেনে নেওয়া)। লগে/মেইলে IP বা ভিজিটরের তথ্য নেই।
export type NoticeInput = { apiKey: string; to: string; subject: string; text: string; from?: string; fetchImpl?: typeof fetch; timeoutMs?: number };

export async function sendNotice(i: NoticeInput): Promise<boolean> {
  const { fetchImpl = fetch, timeoutMs = 4000, from = "Blog <onboarding@resend.dev>" } = i;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${i.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [i.to], subject: i.subject.slice(0, 200), text: i.text.slice(0, 2000) }),
      signal: ctl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}
