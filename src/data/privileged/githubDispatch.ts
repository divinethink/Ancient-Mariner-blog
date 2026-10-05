// Privileged allowlist ৭ (Arch §২): GitHub `workflow_dispatch` (deploy.yml) — fine-grained token, শুধু এই repo-র Actions।
// শুধু `app/**/route.ts` থেকে import (ESLint)। `concurrency` group-এ পরপর dispatch এক build-এ জমে, তাই retry নিরাপদ।
import { withRetry } from "../retry";

export type DispatchConfig = {
  token: string;
  /** "owner/repo" */
  repo: string;
  workflow?: string;
  ref?: string;
  fetchImpl?: typeof fetch;
  retries?: number;
};

export async function dispatchDeploy(cfg: DispatchConfig): Promise<void> {
  const { token, repo, workflow = "deploy.yml", ref = "main", fetchImpl = fetch, retries } = cfg;
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;
  await withRetry(
    async (signal) => {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "ancient-mariner-blog",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref }),
        signal,
      });
      // সফল = 204; token কখনো error-বার্তায় নয়
      if (res.status !== 204) throw new Error(`GitHub dispatch ${res.status}`);
    },
    { retries },
  );
}
