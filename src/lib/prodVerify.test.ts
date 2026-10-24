import { describe, expect, it } from "vitest";
import {
  backupFreshness,
  diffRules,
  evaluateProbe,
  normalizeRules,
  PROBES,
  probeBody,
} from "./prodVerify";

const tpl = (extra = "") => `rules_version = '2';
// মন্তব্য
service cloud.firestore { match /databases/{d}/documents {
  match /posts/{id} { allow read: if true; }
  match /drafts/{id} { allow read: if false; } ${extra}
  match /{document=**} { allow read, write: if false; }
} }`;

describe("normalizeRules / diffRules", () => {
  it("মন্তব্য ও ফাঁকা উপেক্ষা করে সমান ধরে", () => {
    expect(normalizeRules("a  // x\n b")).toBe("a b");
    const d = diffRules(
      tpl().replace("// মন্তব্য", "// অন্য মন্তব্য").replace(/\n/g, "\n\n"),
      tpl(),
    );
    expect(d).toEqual({ same: true, missingInLive: [], extraInLive: [] });
  });
  it("live-এ collection না থাকলে missingInLive; বাড়তি থাকলে extraInLive", () => {
    const expected = tpl("match /comments/{c} { allow read: if true; }");
    const stale = diffRules(tpl(), expected);
    expect(stale.same).toBe(false);
    expect(stale.missingInLive).toEqual(["comments"]);
    expect(stale.extraInLive).toEqual([]);
    const extra = diffRules(expected, tpl());
    expect(extra.extraInLive).toEqual(["comments"]);
  });
  it("শুধু শর্ত বদলালে (collection একই) same=false", () => {
    expect(diffRules(tpl().replace("read: if true", "read, write: if true"), tpl()).same).toBe(
      false,
    );
  });
});

describe("probeBody", () => {
  it("filter-ছাড়া: where নেই, limit ১", () => {
    const b = probeBody({ name: "x", collection: "ideas", expect: "deny" });
    expect(b.structuredQuery).toEqual({ from: [{ collectionId: "ideas" }], limit: 1 });
  });
  it("এক filter সরাসরি; দুই filter AND", () => {
    const one = probeBody({
      name: "x",
      collection: "posts",
      where: { status: "draft" },
      expect: "deny",
    }).structuredQuery.where as { fieldFilter: unknown };
    expect(one.fieldFilter).toBeTruthy();
    const two = probeBody({
      name: "x",
      collection: "posts",
      where: { status: "published", visibility: "public" },
      expect: "allow",
    }).structuredQuery.where as { compositeFilter: { op: string; filters: unknown[] } };
    expect(two.compositeFilter.op).toBe("AND");
    expect(two.compositeFilter.filters).toHaveLength(2);
  });
  it("সব probe-এর body বৈধ ও limit ১", () => {
    for (const p of PROBES)
      expect((probeBody(p).structuredQuery as { limit: number }).limit).toBe(1);
  });
});

describe("evaluateProbe", () => {
  const d = { name: "d", collection: "drafts", expect: "deny" as const };
  const a = { name: "a", collection: "posts", expect: "allow" as const };
  const i = { name: "i", collection: "posts", expect: "info" as const };
  it("deny: ৪০৩ পাস, ২০০ ফেল (ফাঁস)", () => {
    expect(evaluateProbe(d, 403)).toBe("pass");
    expect(evaluateProbe(d, 200)).toBe("fail");
  });
  it("allow: ২০০ পাস, ৪০৩ ফেল (rules পুরনো/ভাঙা)", () => {
    expect(evaluateProbe(a, 200)).toBe("pass");
    expect(evaluateProbe(a, 403)).toBe("fail");
  });
  it("৪০০/৫০০/নেটওয়ার্ক = error — কখনো পাস নয়", () => {
    for (const s of [0, 400, 429, 500, 503]) {
      expect(evaluateProbe(d, s)).toBe("error");
      expect(evaluateProbe(a, s)).toBe("error");
    }
  });
  it("info শুধু অবস্থা জানায়", () => {
    expect(evaluateProbe(i, 200)).toBe("info");
    expect(evaluateProbe(i, 403)).toBe("info");
    expect(evaluateProbe(i, 500)).toBe("error");
  });
});

describe("backupFreshness", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  it("একটাও নেই ⇒ fail", () => expect(backupFreshness([], now).status).toBe("fail"));
  it("১ দিন ⇒ pass; ৩ দিনের বেশি ⇒ fail; সর্বশেষটাই ধরে", () => {
    expect(backupFreshness([new Date("2026-10-23T12:00:00Z")], now).status).toBe("pass");
    expect(backupFreshness([new Date("2026-10-20T12:00:00Z")], now).status).toBe("fail");
    expect(
      backupFreshness([new Date("2026-10-01T00:00:00Z"), new Date("2026-10-24T00:00:00Z")], now)
        .status,
    ).toBe("pass");
  });
});
