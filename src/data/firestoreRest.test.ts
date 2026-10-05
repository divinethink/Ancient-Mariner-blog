import { describe, expect, it } from "vitest";
import { decodeDocument, decodeValue, publishedPostsQuery } from "./firestoreRest";

describe("decodeValue", () => {
  it("scalar ও timestamp", () => {
    expect(decodeValue({ stringValue: "বাংলা" })).toBe("বাংলা");
    expect(decodeValue({ integerValue: "42" })).toBe(42);
    expect(decodeValue({ doubleValue: 1.5 })).toBe(1.5);
    expect(decodeValue({ booleanValue: false })).toBe(false);
    expect(decodeValue({ nullValue: null })).toBeNull();
    const d = decodeValue({ timestampValue: "2026-10-05T01:02:03Z" });
    expect(d).toBeInstanceOf(Date);
    expect((d as Date).toISOString()).toBe("2026-10-05T01:02:03.000Z");
  });
  it("array ও map (খালি-সহ)", () => {
    expect(decodeValue({ arrayValue: {} })).toEqual([]);
    expect(decodeValue({ arrayValue: { values: [{ stringValue: "a" }, { integerValue: "1" }] } })).toEqual(["a", 1]);
    expect(decodeValue({ mapValue: { fields: { x: { stringValue: "y" } } } })).toEqual({ x: "y" });
  });
});

describe("decodeDocument", () => {
  it("id = নামের শেষ অংশ", () => {
    const r = decodeDocument({
      name: "projects/p/databases/(default)/documents/posts/abc123",
      fields: { title: { stringValue: "t" } },
    });
    expect(r).toEqual({ id: "abc123", data: { title: "t" } });
  });
  it("fields না থাকলে খালি", () => {
    expect(decodeDocument({ name: "x/y" }).data).toEqual({});
  });
});

describe("publishedPostsQuery", () => {
  it("explicit published+public filter ও publishedAt desc", () => {
    const q = JSON.stringify(publishedPostsQuery());
    expect(q).toContain('"fieldPath":"status"');
    expect(q).toContain('"stringValue":"published"');
    expect(q).toContain('"fieldPath":"visibility"');
    expect(q).toContain('"stringValue":"public"');
    expect(q).toContain('"direction":"DESCENDING"');
  });
});
