// build-সময়ে D1 থেকে 'পঠিত' ডেটা পড়া (P11a-২; Arch §১৭ P11a, পথ গ-এর অংশ): GitHub Actions-এ চলে, Worker-এ নয়।
// Cloudflare REST API (`CLOUDFLARE_API_TOKEN`-এর D1 অনুমতি — deploy-এর token-ই) দিয়ে শুধু SELECT। ব্যর্থতা কলারে throw —
// কলার (`fetch-public-data`) ধরে খালি তালিকা রাখে: 'পঠিত' না থাকলে সাইট-build কখনো থামে না।
import { withRetry } from "./retry";

const API = "https://api.cloudflare.com/client/v4";
export const D1_DB_NAME = "blog-counter";

export type D1RestEnv = { token: string; accountId: string; fetchFn?: typeof fetch };

async function cf(env: D1RestEnv, path: string, init: RequestInit = {}): Promise<unknown> {
  const f = env.fetchFn ?? fetch;
  const res = await withRetry(
    async (signal) => {
      const r = await f(`${API}${path}`, {
        ...init,
        signal,
        headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
      });
      if (r.status >= 500 || r.status === 429) throw new Error(`Cloudflare API ${r.status}`); // retry-যোগ্য
      return r;
    },
    { timeoutMs: 10_000, retries: 2 },
  );
  const json = (await res.json().catch(() => null)) as { success?: boolean; errors?: { message?: string }[]; result?: unknown } | null;
  if (!res.ok || !json?.success) {
    const msg = json?.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new Error(`Cloudflare API: ${String(msg).slice(0, 160)}`); // token কখনো message-এ নেই
  }
  return json.result;
}

/** database নাম → uuid (auto-provisioned DB-র id কনফিগে নেই, তাই নাম দিয়ে খোঁজা); না পেলে null */
export async function findDatabaseId(env: D1RestEnv, name = D1_DB_NAME): Promise<string | null> {
  const r = (await cf(env, `/accounts/${encodeURIComponent(env.accountId)}/d1/database?name=${encodeURIComponent(name)}`)) as { uuid?: string; name?: string }[] | null;
  return (Array.isArray(r) ? r : []).find((d) => d.name === name && typeof d.uuid === "string")?.uuid ?? null;
}

/** `fromDay` ("YYYY-MM-DD", সাইট-timezone) থেকে এ পর্যন্ত পোস্ট-প্রতি মোট ভিউ, কমে; `limit` শুধু র‍্যাংক-ছাঁটা (মোট নয়) */
export async function queryPostViews(env: D1RestEnv, fromDay: string, limit = 50): Promise<{ postId: string; n: number }[]> {
  const id = await findDatabaseId(env);
  if (!id) throw new Error(`D1 database '${D1_DB_NAME}' পাওয়া যায়নি`);
  const r = (await cf(env, `/accounts/${encodeURIComponent(env.accountId)}/d1/database/${encodeURIComponent(id)}/query`, {
    method: "POST",
    body: JSON.stringify({
      sql: "SELECT postId, SUM(n) AS n FROM viewCounts WHERE day >= ? GROUP BY postId ORDER BY n DESC LIMIT ?",
      params: [fromDay, limit],
    }),
  })) as { results?: { postId: string; n: number }[] }[] | null;
  return Array.isArray(r) ? (r[0]?.results ?? []) : [];
}
