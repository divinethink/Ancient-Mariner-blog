// pageRepo.client-কে আসল rules-এর নিচে Emulator-এ চালানো (P4b-১)
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import type { Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PageExistsError, PageRuleError } from "../../src/data/pageRepo";
import { createPageRepoClient } from "../../src/data/pageRepo.client";
import { renderRules } from "../../src/lib/renderRules";

const OWNER = "testOwnerUid1234567890";
let env: RulesTestEnvironment;
const fs = (x: unknown) => x as Firestore;
const repo = () => createPageRepoClient(fs(env.authenticatedContext(OWNER).firestore()), OWNER);

beforeAll(async () => {
  const rules = renderRules(readFileSync("firestore.rules.tpl", "utf8"), OWNER);
  env = await initializeTestEnvironment({ projectId: "demo-ancientmarinerblog", firestore: { rules } });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

describe("pageRepo.client (Emulator)", () => {
  it("ensureSystemPages: about+privacy Draft+system; দ্বিতীয়বার কিছু বদলায় না (idempotent)", async () => {
    expect(await repo().ensureSystemPages()).toBe(2);
    await repo().update("about", { title: "আমার কথা" });
    expect(await repo().ensureSystemPages()).toBe(0);
    const list = await repo().list();
    expect(list.map((p) => p.slug).sort()).toEqual(["about", "privacy"]);
    expect(list.every((p) => p.system && p.status === "draft")).toBe(true);
    expect((await repo().get("about"))?.title).toBe("আমার কথা");
  });

  it("create → get round-trip; একই slug-এ দ্বিতীয় create = PageExistsError; reserved slug আটকায়", async () => {
    const p = await repo().create({ slug: "contact", title: "যোগাযোগ", body: "{}", status: "draft" });
    expect(p).toMatchObject({ slug: "contact", system: false, ownerUid: OWNER });
    await expect(repo().create({ slug: "contact", title: "x", body: "{}", status: "draft" })).rejects.toBeInstanceOf(PageExistsError);
    await expect(repo().create({ slug: "blog", title: "x", body: "{}", status: "draft" })).rejects.toBeInstanceOf(PageRuleError);
  });

  it("update: শিরোনাম/অবস্থা বদলায়, system ফ্ল্যাগ অক্ষত", async () => {
    await repo().ensureSystemPages();
    const u = await repo().update("privacy", { status: "published" });
    expect(u.status).toBe("published");
    expect(u.system).toBe(true);
  });

  it("remove: সাধারণ পেজ মোছে (idempotent); system পেজে PageRuleError ও doc অক্ষত", async () => {
    await repo().create({ slug: "tmp", title: "t", body: "{}", status: "draft" });
    await repo().remove("tmp");
    await repo().remove("tmp");
    expect(await repo().get("tmp")).toBeNull();
    await repo().ensureSystemPages();
    await expect(repo().remove("about")).rejects.toBeInstanceOf(PageRuleError);
    expect(await repo().get("about")).not.toBeNull();
  });
});
