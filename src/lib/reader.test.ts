import { describe, expect, it } from "vitest";
import { absoluteUrl, facebookShareUrl, resolveReaderSize } from "./reader";

describe("resolveReaderSize", () => {
  it("বৈধ মান থাকে, অবৈধ → m", () => {
    expect(resolveReaderSize("l")).toBe("l");
    expect(resolveReaderSize("xl")).toBe("m");
    expect(resolveReaderSize(null)).toBe("m");
  });
});
describe("facebookShareUrl", () => {
  it("encode করা sharer লিংক", () => {
    expect(facebookShareUrl("https://a.com/blog/x")).toBe("https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fa.com%2Fblog%2Fx");
  });
  it("অবৈধ/js:/খালি → null", () => {
    expect(facebookShareUrl(undefined)).toBeNull();
    expect(facebookShareUrl("javascript:alert(1)")).toBeNull();
    expect(facebookShareUrl("nope")).toBeNull();
  });
});
describe("absoluteUrl", () => {
  it("siteUrl + path", () => {
    expect(absoluteUrl("https://a.com", "/blog/x")).toBe("https://a.com/blog/x");
    expect(absoluteUrl(undefined, "/blog/x")).toBeUndefined();
  });
});
