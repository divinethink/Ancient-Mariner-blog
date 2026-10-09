// firestore.indexes.json-এর কাঠামো-যাচাই: ভুল জায়গার এন্ট্রি (যেমন fieldOverride `indexes`-এ ঢুকে পড়া) deploy-এর আগেই CI-তে ধরা পড়ে
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Idx = { collectionGroup?: string; queryScope?: string; fields?: { fieldPath?: string }[] };
type Ovr = { collectionGroup?: string; fieldPath?: string; indexes?: unknown[] };
const file = JSON.parse(readFileSync("firestore.indexes.json", "utf8")) as {
  indexes: Idx[];
  fieldOverrides: Ovr[];
};

describe("firestore.indexes.json", () => {
  it("composite index: collectionGroup + queryScope + ≥২ ফিল্ড", () => {
    for (const i of file.indexes) {
      expect(i.collectionGroup, JSON.stringify(i)).toBeTruthy();
      expect(i.queryScope).toBe("COLLECTION");
      expect(i.fields?.length ?? 0, `${i.collectionGroup}: fields`).toBeGreaterThanOrEqual(2);
    }
  });
  it("fieldOverride: collectionGroup + fieldPath + indexes[]", () => {
    for (const o of file.fieldOverrides) {
      expect(o.collectionGroup && o.fieldPath, JSON.stringify(o)).toBeTruthy();
      expect(Array.isArray(o.indexes)).toBe(true);
    }
  });
  it("templates.body exemption আছে (বড় body-তে index-সীমা এড়াতে)", () => {
    expect(
      file.fieldOverrides.some((o) => o.collectionGroup === "templates" && o.fieldPath === "body"),
    ).toBe(true);
  });
});
