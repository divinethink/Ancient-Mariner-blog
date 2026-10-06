import { describe, expect, it } from "vitest";
import { decodeJwt, exportPKCS8, generateKeyPair } from "jose";
import { createTokenProvider, parseServiceAccount } from "./googleAuth";

async function sa() {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  return {
    client_email: "svc@proj.iam.gserviceaccount.com",
    private_key: await exportPKCS8(privateKey),
  };
}

describe("parseServiceAccount", () => {
  it("বৈধ JSON", async () => {
    const s = await sa();
    expect(parseServiceAccount(JSON.stringify({ ...s, extra: 1 })).client_email).toBe(
      s.client_email,
    );
  });
  it("ভুল হলে স্পষ্ট বার্তা, key ফাঁস নয়", () => {
    expect(() => parseServiceAccount("not json")).toThrow(/বৈধ JSON/);
    expect(() => parseServiceAccount(JSON.stringify({ client_email: "x" }))).toThrow(/private_key/);
  });
});

describe("createTokenProvider", () => {
  it("সঠিক JWT-bearer অনুরোধ; token cache হয়; মেয়াদ কাছাকাছি হলে নতুন", async () => {
    const s = await sa();
    let now = 1_800_000_000_000;
    const calls: { url: string; body: URLSearchParams }[] = [];
    const f = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body as URLSearchParams });
      return new Response(JSON.stringify({ access_token: `tok${calls.length}`, expires_in: 3600 }));
    }) as typeof fetch;
    const get = createTokenProvider({ serviceAccount: s, fetchImpl: f, nowMs: () => now });
    expect(await get()).toBe("tok1");
    expect(await get()).toBe("tok1");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://oauth2.googleapis.com/token");
    expect(calls[0].body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    const claims = decodeJwt(calls[0].body.get("assertion") as string);
    expect(claims.iss).toBe(s.client_email);
    expect(claims.aud).toBe("https://oauth2.googleapis.com/token");
    expect(claims.scope).toBe("https://www.googleapis.com/auth/datastore");
    now += 3600_000 - 30_000;
    expect(await get()).toBe("tok2");
  });

  it("ব্যর্থ হলে বার্তায় private key বা assertion নেই", async () => {
    const s = await sa();
    const f = (async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
    const err = await createTokenProvider({ serviceAccount: s, fetchImpl: f })().then(
      () => "no error",
      (e: Error) => e.message,
    );
    expect(err).toContain("401");
    expect(err).not.toContain("PRIVATE KEY");
  });
});
