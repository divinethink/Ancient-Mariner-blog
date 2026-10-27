import { describe, expect, it } from "vitest";
import { MAX_DIARY_PHOTOS, photoIdsOf, withPhotos } from "./diaryPhotos";
import { textToDoc } from "./diary";
import { docToText, parseBody, serializeDoc } from "./editorDoc";

describe("diaryPhotos", () => {
  it("ছবি doc-এর শেষে বসে; টেক্সট/শব্দ অপরিবর্তিত; body round-trip-এ id ফেরে", () => {
    const base = textToDoc("আজ ভালো দিন");
    const doc = withPhotos(base, [{ id: "a1", alt: "নদী" }, { id: "b2" }]);
    expect(docToText(doc)).toBe(docToText(base));
    expect(photoIdsOf(serializeDoc(doc))).toEqual(["a1", "b2"]);
    expect(doc.content!.at(-1)).toMatchObject({ type: "mediaImage", attrs: { mediaId: "b2", alt: "" } });
    expect(base.content).toHaveLength(1); // মূল doc বদলায়নি
  });
  it("ডুপ্লিকেট বাদ, সীমা ছয়, ছবি না থাকলে একই doc", () => {
    const base = textToDoc("x");
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `m${i % 8}` }));
    expect(photoIdsOf(serializeDoc(withPhotos(base, many)))).toHaveLength(MAX_DIARY_PHOTOS);
    expect(photoIdsOf(serializeDoc(withPhotos(base, [{ id: "z" }, { id: "z" }])))).toEqual(["z"]);
    expect(withPhotos(base, [])).toBe(base);
  });
  it("অবৈধ id sanitize-এ বাদ; অবৈধ body = ছবি নেই", () => {
    const bad = withPhotos(textToDoc("x"), [{ id: "bad id!" }]);
    expect(photoIdsOf(serializeDoc(bad))).toEqual([]);
    expect(photoIdsOf("not json")).toEqual([]);
    expect(parseBody("not json")).toBeTruthy();
  });
});
