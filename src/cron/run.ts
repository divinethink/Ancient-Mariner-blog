// Cron entry-র যুক্তি (P5a-৩; P11a cleanup ও P11c dispatcher একই entry-তে যোগ হবে)। `worker.ts`-এর `scheduled` থেকে ডাকা হয়।
// প্রতিটা কাজ আলাদা try/catch — একটা ব্যর্থ হলে অন্যটা চলে; শেষে ব্যর্থ থাকলে throw (Cloudflare-এ invocation 'error' দেখায়)।
import { getCronEnv } from "../config/env";
import { createAdminDb, createBudget } from "../data/privileged/firestoreAdmin";
import { createTokenProvider, parseServiceAccount } from "../data/privileged/googleAuth";
import { pruneRevisions, purgeTrash } from "../data/privileged/revisionCron";
import { dispatchDeploy } from "../data/privileged/githubDispatch";
import { publishDue } from "../data/privileged/scheduleCron";
import { cleanupRateLimits, markRebuildDirty, takeRebuildDirty, type D1Like } from "../data/counterRepo";
import { REBUILD_DIRTY_KEY } from "../lib/comments";
import { dayKey } from "../lib/datetime";
import { isHeavySlot } from "../lib/schedule";
import { createLogger } from "../lib/logger";

const shuffle = <T>(a: T[]): T[] => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

export async function runScheduled(source: unknown, nowMs: number = Date.now()): Promise<void> {
  const log = createLogger();
  const env = getCronEnv(source);
  const budget = createBudget();
  const db = createAdminDb({
    projectId: env.FIREBASE_PROJECT_ID,
    budget,
    getToken: createTokenProvider({
      serviceAccount: parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT),
      onRequest: () => budget.spend(),
    }),
  });

  let failed = 0;
  const step = async (name: string, fn: () => Promise<Record<string, unknown>>) => {
    try {
      log.info(`cron.${name}.ok`, await fn());
    } catch (e) {
      failed++;
      log.error(`cron.${name}.fail`, { error: e instanceof Error ? e.message : "unknown" });
    }
  };

  // P11c-১: Cron প্রতি ১৫ মিনিটে; ভারী কাজ (Firestore read) আগের মতো ~৬ ঘণ্টায় একবার (isHeavySlot)
  let publishedNow = 0;
  await step("publishDue", async () => {
    const r = await publishDue(db, nowMs, log);
    publishedNow = r.published;
    return r;
  });
  const d1 = (source as { DB?: D1Like } | null)?.DB;
  let rebuilt = false;
  if (publishedNow > 0 && env.GITHUB_TOKEN && env.GITHUB_REPO) {
    // rebuild trigger; ব্যর্থ হলে পোস্ট ইতিমধ্যে published — ৩-ঘণ্টার deploy schedule-ই তুলে নেবে
    await step("rebuild", async () => {
      await dispatchDeploy({ token: env.GITHUB_TOKEN!, repo: env.GITHUB_REPO! });
      rebuilt = true;
      return { dispatched: true };
    });
  } else if (publishedNow > 0) {
    log.warn("cron.rebuild.skip", { reason: "GITHUB_TOKEN/GITHUB_REPO নেই — পরের নির্ধারিত deploy-এ live হবে" });
  }
  // P11b-২: নতুন/বদলানো মন্তব্য থাকলে (D1 চিহ্ন) একবার rebuild — ১৫ মিনিটে সর্বোচ্চ একটা, spam হলেও না। dispatch ব্যর্থ হলে চিহ্ন ফিরিয়ে পরের চালনায় আবার
  if (d1 && env.GITHUB_TOKEN && env.GITHUB_REPO) {
    await step("commentRebuild", async () => {
      if (!(await takeRebuildDirty(d1, REBUILD_DIRTY_KEY))) return { dirty: false };
      if (rebuilt) return { dirty: true, dispatched: "আগের ধাপেই" };
      try {
        await dispatchDeploy({ token: env.GITHUB_TOKEN!, repo: env.GITHUB_REPO! });
      } catch (e) {
        await markRebuildDirty(d1, REBUILD_DIRTY_KEY, dayKey(nowMs)).catch(() => undefined);
        throw e;
      }
      return { dirty: true, dispatched: true };
    });
  }
  const heavy = isHeavySlot(nowMs);
  if (heavy) {
    await step("trashPurge", () => purgeTrash(db, nowMs, log));
    await step("revisionPrune", () => pruneRevisions(db, nowMs, log, shuffle));
  }
  // P11a-১: পুরনো dedupe row পরিষ্কার (২ দিনের আগের); DB binding না থাকলে বাদ
  if (d1 && heavy) {
    await step("d1Cleanup", async () => ({ deleted: await cleanupRateLimits(d1, dayKey(nowMs - 2 * 86_400_000)) }));
  }
  log.info("cron.done", { failed, subrequests: budget.used });
  if (failed > 0) throw new Error(`cron: ${failed}টি কাজ ব্যর্থ`);
}
