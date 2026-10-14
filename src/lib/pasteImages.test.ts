import { describe, expect, it } from "vitest";
import { PASTE_IMG_MAX, pasteToken, prepareImport, safeImageUrl } from "./pasteImages";

describe("pasteImages", () => {
  it("safeImageUrl: শুধু http/https; data:/ইউজার/অবৈধ বাদ; //host ⇒ https", () => {
    expect(safeImageUrl("https://a.com/x.jpg?a=1&amp;b=2")).toBe("https://a.com/x.jpg?a=1&b=2");
    expect(safeImageUrl("//a.com/x.jpg")).toBe("https://a.com/x.jpg");
    expect(safeImageUrl("data:image/png;base64,AAAA")).toBeNull();
    expect(safeImageUrl("javascript:alert(1)")).toBeNull();
    expect(safeImageUrl("https://u:p@a.com/x.jpg")).toBeNull();
    expect(safeImageUrl("")).toBeNull();
    expect(safeImageUrl(null)).toBeNull();
  });
  it("img ⇒ চিহ্ন; একই ঠিকানা একবারই; alt ধরা", () => {
    const r = prepareImport('<p>ক <img src="https://a.com/1.jpg" alt="প্রথম"> খ <img src="https://a.com/1.jpg"></p>', "t1");
    expect(r.urls).toEqual(["https://a.com/1.jpg"]);
    expect(r.alts).toEqual(["প্রথম"]);
    expect(r.html).toBe(`<p>ক <span>${pasteToken("t1", 0)}</span> খ <span>${pasteToken("t1", 0)}</span></p>`);
  });
  it("lazy-load: data-src আগে (src placeholder হলেও); ইমোজি/ট্র্যাকিং/data: বাদ", () => {
    const r = prepareImport(
      '<img src="data:image/gif;base64,R0" data-src="https://a.com/real.jpg"><img class="emoji" src="https://s.w.org/e.png"><img width="1" height="1" src="https://t.com/p.gif"><img src="data:image/png;base64,AAA">',
      "t2",
    );
    expect(r.urls).toEqual(["https://a.com/real.jpg"]);
    expect(r.html).not.toContain("s.w.org");
    expect(r.html).not.toContain("t.com");
    expect(r.html).not.toContain("data:");
  });
  it("সীমা: PASTE_IMG_MAX-এর বেশি ছবি বাদ", () => {
    const html = Array.from({ length: PASTE_IMG_MAX + 3 }, (_, i) => `<img src="https://a.com/${i}.jpg">`).join("");
    expect(prepareImport(html, "t3").urls).toHaveLength(PASTE_IMG_MAX);
  });
  it("ছবি না থাকলে urls খালি", () => {
    expect(prepareImport("<p>শুধু লেখা</p>", "t4").urls).toEqual([]);
  });
});
