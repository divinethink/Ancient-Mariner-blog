import { describe, expect, it } from "vitest";
import { pickPopular } from "./popular";

const pub = new Set(["A", "B", "C", "D"]);

describe("pickPopular", () => {
  it("ভিউ কমে সাজায়; সমান হলে postId-ক্রমে", () => {
    const r = pickPopular([{ postId: "B", n: 3 }, { postId: "A", n: 3 }, { postId: "C", n: 9 }], pub);
    expect(r.map((x) => x.postId)).toEqual(["C", "A", "B"]);
  });
  it("মোছা/অ-published ও বিকৃত সারি বাদ; একই postId-র সারি যোগ", () => {
    const r = pickPopular([{ postId: "GONE", n: 50 }, null, "x", { postId: "A", n: "oops" }, { postId: "A", n: 2 }, { postId: "A", n: 3 }, { postId: "D", n: 0 }], pub);
    expect(r).toEqual([{ postId: "A", n: 5 }]);
  });
  it("limit মানে; ডেটা না থাকলে খালি", () => {
    expect(pickPopular([{ postId: "A", n: 1 }, { postId: "B", n: 2 }], pub, 1)).toEqual([{ postId: "B", n: 2 }]);
    expect(pickPopular([], pub)).toEqual([]);
  });
});
