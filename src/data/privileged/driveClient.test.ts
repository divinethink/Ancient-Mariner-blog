import { describe, expect, it } from "vitest";
import { createDriveClient } from "./driveClient";

type Call = { url: string; init: RequestInit };
const mk = (handler: (c: Call) => Response, calls: Call[] = []) =>
  createDriveClient({
    clientId: "CID",
    clientSecret: "SECRET",
    refreshToken: "RT",
    fetchImpl: (async (u: string, init?: RequestInit) => {
      const c = { url: String(u), init: init ?? {} };
      calls.push(c);
      if (c.url.includes("oauth2.googleapis.com"))
        return new Response(JSON.stringify({ access_token: "AT", expires_in: 3600 }));
      return handler(c);
    }) as unknown as typeof fetch,
  });

describe("driveClient", () => {
  it("upload: multipart, parents, Bearer; Drive-এর size ফেরত", async () => {
    const calls: Call[] = [];
    const d = mk(
      () => new Response(JSON.stringify({ id: "F1", name: "posts.json", size: "7" })),
      calls,
    );
    const f = await d.uploadJson("FOLDER1", "posts.json", '{"a":1}');
    expect(f).toEqual({ id: "F1", name: "posts.json", size: 7 });
    const up = calls.find((c) => c.url.includes("/upload/drive/v3/files"))!;
    expect((up.init.headers as Record<string, string>).authorization).toBe("Bearer AT");
    expect(String((up.init.headers as Record<string, string>)["content-type"])).toMatch(
      /^multipart\/related; boundary=/,
    );
    expect(Buffer.from(up.init.body as Buffer).toString()).toContain('"parents":["FOLDER1"]');
  });
  it("অবৈধ folder-id আটকায়; refresh ব্যর্থ হলে বার্তায় secret নেই", async () => {
    const d = mk(() => new Response("{}"));
    await expect(d.uploadJson("bad id'", "a.json", "{}")).rejects.toThrow("অবৈধ Drive id");
    const bad = createDriveClient({
      clientId: "CID",
      clientSecret: "SECRET",
      refreshToken: "RT",
      fetchImpl: (async () => new Response("{}", { status: 400 })) as unknown as typeof fetch,
    });
    const e = await bad.deleteFolder("FOLDER12345").catch((x: Error) => x);
    expect(String((e as Error).message)).not.toMatch(/SECRET|RT\b/);
  });
  it("deleteFolder: 404 = সফল", async () => {
    const d = mk(() => new Response(null, { status: 404 }));
    await expect(d.deleteFolder("FOLDER12345")).resolves.toBeUndefined();
  });
});
