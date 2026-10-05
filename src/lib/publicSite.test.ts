import { describe, expect, it } from "vitest";
import { blogPath, planSlugMoves, postExcerpt, renderRedirects } from "./publicSite";

const doc = (t: string) =>
  JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] });

describe("postExcerpt", () => {
  it("নিজের সারাংশ থাকলে তা-ই", () => {
    expect(postExcerpt({ excerpt: " ছোট ", body: doc("লেখা") })).toBe("ছোট");
  });
  it("খালি হলে লেখা থেকে; বিকৃত body-তে খালি", () => {
    expect(postExcerpt({ excerpt: "", body: doc("কুয়াশা মাখা ভোর") })).toBe("কুয়াশা মাখা ভোর");
    expect(postExcerpt({ excerpt: "", body: "{bad" })).toBe("");
  });
});

describe("planSlugMoves", () => {
  it("ASCII → redirects, বাংলা → stubs", () => {
    const r = planSlugMoves([{ slug: "নতুন", slugHistory: ["old-one", "পুরনো"] }]);
    expect(r.redirects).toEqual([{ from: "old-one", to: "নতুন" }]);
    expect(r.stubs).toEqual([{ from: "পুরনো", to: "নতুন" }]);
  });
  it("জীবিত slug-এর সাথে সংঘাতে নতুন পোস্ট জেতে", () => {
    const r = planSlugMoves([
      { slug: "a", slugHistory: ["b"] },
      { slug: "b", slugHistory: [] },
    ]);
    expect(r.redirects).toEqual([]);
  });
  it("একই পুরনো slug দুই history-তে — প্রথমটা (নতুন পোস্ট) জেতে; নিজের slug ও খালি বাদ", () => {
    const r = planSlugMoves([
      { slug: "x", slugHistory: ["dup", "x", ""] },
      { slug: "y", slugHistory: ["dup"] },
    ]);
    expect(r.redirects).toEqual([{ from: "dup", to: "x" }]);
  });
  it("অনিরাপদ ASCII (স্পেস, *, বড় হাত) stub-এ যায়, _redirects-এ নয়", () => {
    const r = planSlugMoves([{ slug: "n", slugHistory: ["a b", "x*", "Up"] }]);
    expect(r.redirects).toEqual([]);
    expect(r.stubs.map((s) => s.from)).toEqual(["a b", "x*", "Up"]);
  });
});

describe("renderRedirects", () => {
  it("308 লাইন; লক্ষ্য percent-encoded", () => {
    expect(renderRedirects([{ from: "old", to: "নতুন" }])).toBe(
      `/blog/old ${blogPath("নতুন")} 308\n`,
    );
    expect(renderRedirects([])).toBe("");
  });
});
