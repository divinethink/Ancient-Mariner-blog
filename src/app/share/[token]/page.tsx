// Share-link পেজ (P11c-২): token-ধারী যে কেউ একটি লেখা (draft/private/scheduled সহ) পড়তে পারে — মেয়াদ ও revoke সহ।
// runtime-এ চলে (Worker); build-snapshot/`PublicShell` ইচ্ছাকৃতভাবে নেই (fs নেই, আর এটি সাইটের অংশ নয়)। অচল লিংক = পাবলিক হোমে redirect।
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PostArticle } from "@/components/public/PostArticle";
import { getShareEnv } from "@/config/env";
import { createAdminDb, createBudget } from "@/data/privileged/firestoreAdmin";
import { createTokenProvider, parseServiceAccount } from "@/data/privileged/googleAuth";
import { resolveShare, type ShareView } from "@/data/privileged/shareView";
import { bn } from "@/i18n/bn";
import { countWords, parseBody, docToText } from "@/lib/editorDoc";
import { createLogger } from "@/lib/logger";
import { readingMinutes } from "@/lib/readingTime";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: bn.shareLink.pageTitle,
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const log = createLogger();

/** infrastructure-ব্যর্থতা ≠ অচল লিংক: ব্যর্থ হলে null (পাঠককে redirect নয়, "পরে চেষ্টা করুন") */
async function load(token: string): Promise<ShareView | null> {
  try {
    const env = getShareEnv();
    const budget = createBudget();
    const db = createAdminDb({
      projectId: env.FIREBASE_PROJECT_ID,
      budget,
      getToken: createTokenProvider({ serviceAccount: parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT), onRequest: () => budget.spend() }),
    });
    return await resolveShare(db, token, Date.now());
  } catch (e) {
    log.error("share.load.fail", { error: e instanceof Error ? e.message : "unknown" });
    return null;
  }
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await load(token);
  if (r === null) {
    return (
      <div role="alert">
        <p>{bn.shareLink.unavailable}</p>
      </div>
    );
  }
  if (r.kind === "gone") redirect("/");

  const doc = parseBody(r.body);
  const words = countWords(docToText(doc));
  const minutes = readingMinutes(words);
  return (
    <div>
      <p role="note" className="mb-4 rounded-xl border border-line bg-surface p-3 text-sm">
        {bn.shareLink.banner}
      </p>
      <PostArticle
        title={r.title}
        meta={
          <>
            {words} {bn.library.words}
            {minutes > 0 && ` · ${bn.public.readMinutes(minutes)}`}
          </>
        }
        body={r.body}
      />
      <p className="mt-8 border-t border-line pt-3 text-sm">
        <Link href="/" prefetch={false} className="inline-flex min-h-11 items-center text-accent-text underline">
          {bn.shareLink.home}
        </Link>
      </p>
    </div>
  );
}
