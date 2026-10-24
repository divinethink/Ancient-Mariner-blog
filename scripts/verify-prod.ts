// Production যাচাই (শুধু পড়া — কিছু লেখে/মোছে না): GitHub Actions `verify-prod.yml` থেকে চলে।
// ১) live Firestore rules বনাম repo-র firestore.rules.tpl (rendered) ২) নামহীন client-এর প্রবেশ-probe ৩) সর্বশেষ backup-এর বয়স।
// কোনো check ব্যর্থ বা যাচাই-অযোগ্য (error) হলে exit 1 ⇒ workflow লাল ⇒ GitHub-এর ইমেইল-খবর।
import { readFileSync } from "node:fs";
import { z } from "zod";
import { createAdminDb, createBudget } from "../src/data/privileged/firestoreAdmin";
import { createTokenProvider, parseServiceAccount } from "../src/data/privileged/googleAuth";
import {
  backupFreshness,
  diffRules,
  evaluateProbe,
  PROBES,
  probeBody,
  type CheckStatus,
} from "../src/lib/prodVerify";
import { renderRules } from "../src/lib/renderRules";

const env = z
  .object({
    FIREBASE_PROJECT_ID: z.string().min(1),
    FIREBASE_SERVER_API_KEY: z.string().min(1),
    FIREBASE_SERVICE_ACCOUNT: z.string().min(1),
    OWNER_UID: z.string().min(1),
  })
  .parse(process.env);

const icon: Record<CheckStatus, string> = { pass: "✅", fail: "❌", info: "ℹ️", error: "⚠️" };
let bad = 0;
const report = (s: CheckStatus, msg: string) => {
  if (s === "fail" || s === "error") bad++;
  console.log(`${icon[s]} ${msg}`);
};
const msgOf = (e: unknown) => (e instanceof Error ? e.message : "অজানা ত্রুটি").slice(0, 160);

async function checkRules(getToken: () => Promise<string>) {
  try {
    const auth = { authorization: `Bearer ${await getToken()}` };
    const rel = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/releases/cloud.firestore`,
      { headers: auth },
    );
    if (!rel.ok)
      return report(
        "error",
        `live rules release পড়া যায়নি (HTTP ${rel.status}) — service account-এ firebaserules read-অনুমতি লাগে`,
      );
    const { rulesetName } = (await rel.json()) as { rulesetName?: string };
    const rs = await fetch(`https://firebaserules.googleapis.com/v1/${rulesetName}`, {
      headers: auth,
    });
    if (!rs.ok) return report("error", `live ruleset পড়া যায়নি (HTTP ${rs.status})`);
    const files =
      ((await rs.json()) as { source?: { files?: { name?: string; content?: string }[] } }).source
        ?.files ?? [];
    const live = (files.find((f) => f.name?.endsWith("firestore.rules")) ?? files[0])?.content;
    if (!live) return report("error", "live ruleset-এ কোনো ফাইল নেই");
    const d = diffRules(
      live,
      renderRules(readFileSync("firestore.rules.tpl", "utf8"), env.OWNER_UID),
    );
    if (d.same) return report("pass", "live rules = repo-র rules (মন্তব্য/ফাঁকা বাদে হুবহু)");
    report(
      "fail",
      `live rules ≠ repo-র rules · live-এ নেই: [${d.missingInLive.join(", ") || "—"}] · live-এ বাড়তি: [${d.extraInLive.join(", ") || "—"}] ⇒ deploy-rules workflow চালান`,
    );
  } catch (e) {
    report("error", `rules-যাচাই ব্যর্থ: ${msgOf(e)}`);
  }
}

async function checkProbes() {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${encodeURIComponent(env.FIREBASE_SERVER_API_KEY)}`;
  for (const p of PROBES) {
    let status = 0;
    try {
      status = (
        await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(probeBody(p)),
        })
      ).status;
    } catch {
      /* নেটওয়ার্ক-ব্যর্থতা ⇒ status 0 ⇒ error */
    }
    const r = evaluateProbe(p, status);
    const note =
      p.expect === "info"
        ? status === 200
          ? " → unlisted লেখা তালিকাভুক্ত করা যায়"
          : status === 403
            ? " → বন্ধ"
            : ""
        : "";
    report(r, `probe ${p.name}: HTTP ${status}${note}`);
  }
}

async function checkBackup(getToken: () => Promise<string>) {
  try {
    const db = createAdminDb({
      projectId: env.FIREBASE_PROJECT_ID,
      getToken,
      budget: createBudget(1000),
    });
    const { docs } = await db.runQuery({
      from: [{ collectionId: "backups" }],
      select: { fields: [{ fieldPath: "completedAt" }] },
      limit: 400,
    });
    const dates = docs.map((d) => d.data.completedAt).filter((x): x is Date => x instanceof Date);
    const r = backupFreshness(dates, new Date());
    report(r.status, `backup-তাজাভাব: ${r.detail}`);
  } catch (e) {
    report("error", `backup-তাজাভাব যাচাই ব্যর্থ: ${msgOf(e)}`);
  }
}

async function main() {
  const sa = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT);
  await checkRules(
    createTokenProvider({
      serviceAccount: sa,
      scope: "https://www.googleapis.com/auth/cloud-platform",
    }),
  );
  await checkProbes();
  await checkBackup(createTokenProvider({ serviceAccount: sa }));
  console.log(bad === 0 ? "\n✅ সব যাচাই সফল" : `\n❌ ${bad}টি ব্যর্থ/অযাচাইকৃত — উপরের লগ দেখুন`);
  process.exit(bad === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("❌ verify-prod ব্যর্থ:", msgOf(e));
  process.exit(1);
});
