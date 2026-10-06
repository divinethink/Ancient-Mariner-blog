// Custom Worker entry (Arch §১৭ P5a): OpenNext-এর generated worker শুধু `fetch` দেয়; এখানে তার `fetch` + নিজস্ব `scheduled` (Cron) দুটোই export।
// `wrangler.jsonc` `main` = এই ফাইল; Cron সময়সূচি `triggers.crons`। P11a (D1 cleanup) ও P11c (scheduled-publish) একই `scheduled`-এ যোগ হবে।
// @ts-expect-error `.open-next/worker.js` `opennextjs-cloudflare build`-এ তৈরি হয় (typecheck-এ থাকে না)
import { default as handler } from "./.open-next/worker.js";
import { runScheduled } from "./src/cron/run";

const worker = {
  fetch: handler.fetch,
  // await না করলে Worker আগেই শেষ হয়ে যেতে পারে; ব্যর্থতা rethrow হয়ে invocation-এ দেখা যায়
  async scheduled(_controller: unknown, env: unknown): Promise<void> {
    await runScheduled(env);
  },
};

export default worker;
