// Cron entry-র যুক্তি (P5a-৩; P11a cleanup ও P11c dispatcher একই entry-তে যোগ হবে)। `worker.ts`-এর `scheduled` থেকে ডাকা হয়।
// প্রতিটা কাজ আলাদা try/catch — একটা ব্যর্থ হলে অন্যটা চলে; শেষে ব্যর্থ থাকলে throw (Cloudflare-এ invocation 'error' দেখায়)।
import { getCronEnv } from "../config/env";
import { createAdminDb, createBudget } from "../data/privileged/firestoreAdmin";
import { createTokenProvider, parseServiceAccount } from "../data/privileged/googleAuth";
import { pruneRevisions, purgeTrash } from "../data/privileged/revisionCron";
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

  await step("trashPurge", () => purgeTrash(db, nowMs, log));
  await step("revisionPrune", () => pruneRevisions(db, nowMs, log, shuffle));
  log.info("cron.done", { failed, subrequests: budget.used });
  if (failed > 0) throw new Error(`cron: ${failed}টি কাজ ব্যর্থ`);
}
