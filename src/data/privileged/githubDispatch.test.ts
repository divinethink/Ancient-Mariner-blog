import { describe, expect, it } from "vitest";
import { dispatchDeploy } from "./githubDispatch";

type Call = { url: string; init: RequestInit };
const fake = (status: number, calls: Call[]): typeof fetch =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(null, { status });
  }) as typeof fetch;

describe("dispatchDeploy", () => {
  it("সঠিক URL/header/body-তে POST; 204 = সফল", async () => {
    const calls: Call[] = [];
    await dispatchDeploy({ token: "tok", repo: "o/r", fetchImpl: fake(204, calls) });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.github.com/repos/o/r/actions/workflows/deploy.yml/dispatches");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ ref: "main" });
    const h = calls[0].init.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer tok");
    expect(h["User-Agent"]).toBeTruthy();
  });
  it("অন্য status-এ throw; বার্তায় token নেই", async () => {
    const calls: Call[] = [];
    const err = await dispatchDeploy({ token: "SECRET-TOK", repo: "o/r", retries: 1, fetchImpl: fake(401, calls) }).catch(
      (e: Error) => e,
    );
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("401");
    expect((err as Error).message).not.toContain("SECRET-TOK");
    expect(calls).toHaveLength(1);
  });
});
