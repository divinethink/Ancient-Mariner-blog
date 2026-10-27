// Custom Worker entry (Arch §১৭ P5a): OpenNext-এর generated worker শুধু `fetch` দেয়; এখানে তার `fetch` + নিজস্ব `scheduled` (Cron) দুটোই export।
// `wrangler.jsonc` `main` = এই ফাইল; Cron সময়সূচি `triggers.crons`। P11a (D1 cleanup) ও P11c (scheduled-publish) একই `scheduled`-এ যোগ হবে।
// @ts-expect-error `.open-next/worker.js` `opennextjs-cloudflare build`-এ তৈরি হয় (typecheck-এ থাকে না)
import { default as handler } from "./.open-next/worker.js";
import { runScheduled } from "./src/cron/run";

// ডিবাগ: /dashboard উত্তরে Server-Timing (app = হ্যান্ডলারের উত্তর-তৈরির সময়, isolate age/hit = ঠান্ডা শুরু কিনা)। দ্রষ্টব্য: Workers-এ Date.now() শুধু I/O-তে এগোয়, তাই CPU-ভারী কাজ app-এ কম দেখাতে পারে।
const BOOT = Date.now();
let hits = 0;

const worker = {
  async fetch(req: Request, env: unknown, ctx: unknown): Promise<Response> {
    const n = ++hits;
    const t = Date.now();
    const res: Response = await handler.fetch(req, env, ctx);
    if (!new URL(req.url).pathname.startsWith("/dashboard")) return res;
    try {
      const out = new Response(res.body, res);
      out.headers.append("Server-Timing", `app;dur=${Date.now() - t}, isolate;desc="age=${t - BOOT}ms hit=${n}"`);
      return out;
    } catch {
      return res;
    }
  },
  // await না করলে Worker আগেই শেষ হয়ে যেতে পারে; ব্যর্থতা rethrow হয়ে invocation-এ দেখা যায়
  async scheduled(_controller: unknown, env: unknown): Promise<void> {
    await runScheduled(env);
  },
};

export default worker;
