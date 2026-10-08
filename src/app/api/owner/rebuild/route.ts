// পাবলিক সাইট rebuild: GitHub `deploy.yml` workflow_dispatch (Arch §২ privileged ৭, §১২)।
// `middleware.ts` session যাচাই করে (/api/owner/*); এখানে POST-only + Origin যাচাই (CSRF)।
import { NextResponse, type NextRequest } from "next/server";
import { getRebuildEnv } from "@/config/env";
import { dispatchDeploy, dispatchDetail } from "@/data/privileged/githubDispatch";
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
    log.error("rebuild env misconfigured", { err: dispatchDetail(e) });
    return NextResponse.json({ error: "misconfigured", detail: dispatchDetail(e) }, { status: 500, headers: noStore });
  }
  if (!isSameOrigin(req.headers.get("origin"), env.SITE_URL)) {
    const detail = `origin ${req.headers.get("origin") ?? "(নেই)"} ≠ SITE_URL ${env.SITE_URL}`;
    log.error("rebuild forbidden", { detail });
    return NextResponse.json({ error: "forbidden", detail }, { status: 403, headers: noStore });
  }
  try {
    await dispatchDeploy({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO });
    return NextResponse.json({ ok: true }, { status: 202, headers: noStore });
  } catch (e) {
    log.error("rebuild dispatch failed", { err: dispatchDetail(e) });
    return NextResponse.json({ error: "dispatch_failed", detail: dispatchDetail(e) }, { status: 502, headers: noStore });
  }
}
