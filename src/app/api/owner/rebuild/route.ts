// পাবলিক সাইট rebuild: GitHub `deploy.yml` workflow_dispatch (Arch §২ privileged ৭, §১২)।
// `middleware.ts` session যাচাই করে (/api/owner/*); এখানে POST-only + Origin যাচাই (CSRF)।
import { NextResponse, type NextRequest } from "next/server";
import { getRebuildEnv } from "@/config/env";
import { dispatchDeploy } from "@/data/privileged/githubDispatch";
import { createLogger } from "@/lib/logger";
import { isSameOrigin } from "@/lib/session";

export const dynamic = "force-dynamic";

const log = createLogger();
const noStore = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  let env: ReturnType<typeof getRebuildEnv>;
  try {
    env = getRebuildEnv();
  } catch (e) {
    log.error("rebuild env misconfigured", { err: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "misconfigured" }, { status: 500, headers: noStore });
  }
  if (!isSameOrigin(req.headers.get("origin"), env.SITE_URL)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });
  }
  try {
    await dispatchDeploy({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO });
    return NextResponse.json({ ok: true }, { status: 202, headers: noStore });
  } catch (e) {
    log.error("rebuild dispatch failed", { err: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "dispatch_failed" }, { status: 502, headers: noStore });
  }
}
