import { describe, expect, it } from "vitest";
import {
  decideSlugClaim,
  fallbackSlug,
  isValidSlug,
  MAX_SLUG_LENGTH,
  nextHistory,
  slugify,
  withSuffix,
} from "./slug";

describe("slugify", () => {
  it("ইংরেজি: lowercase ও '-'", () => {
    expect(slugify("  Hello, World!  ")).toBe("hello-world");
  });
  it("বাংলা অক্ষর, হসন্ত ও কার-চিহ্ন অক্ষত", () => {
    expect(slugify("কক্সবাজারের ভোর")).toBe("কক্সবাজারের-ভোর");
    expect(slugify("সাগর যখন কথা বলে।")).toBe("সাগর-যখন-কথা-বলে");
  });
  it("ZWJ/ZWNJ বাদ; NFC", () => {
    expect(slugify("র\u200d্যাব")).toBe("র্যাব");
    expect(slugify("a\u200cb")).toBe("ab");
  });
  it("সংখ্যা রাখে; শুধু চিহ্ন হলে খালি", () => {
    expect(slugify("২০২৬ সাল")).toBe("২০২৬-সাল");
    expect(slugify("।।!?")).toBe("");
  });
  it("'_' ও '.' ও '/' বাদ (doc-ID নিরাপদ)", () => {
    expect(slugify("a_b.c/d")).toBe("a-b-c-d");
  });
  it("দৈর্ঘ্য সীমা; শেষে '-' নেই", () => {
    expect(slugify("a".repeat(200)).length).toBe(MAX_SLUG_LENGTH);
    expect(slugify(`${"a".repeat(MAX_SLUG_LENGTH - 1)} b`)).toBe("a".repeat(MAX_SLUG_LENGTH - 1));
  });
  it("সীমায় কাটলে কার-চিহ্ন আলাদা হয় না", () => {
    const s = slugify("ক".repeat(MAX_SLUG_LENGTH - 1) + "ক্ষ");
    expect(s.endsWith("ক্ষ")).toBe(true);
  });
  it("idempotent", () => {
    const s = slugify("আমার প্রথম লেখা!");
    expect(slugify(s)).toBe(s);
  });
});

describe("isValidSlug / fallback / suffix", () => {
  it("যাচাই", () => {
    expect(isValidSlug("আমার-লেখা")).toBe(true);
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("A b")).toBe(false);
    expect(isValidSlug("-x")).toBe(false);
  });
  it("fallback বৈধ slug", () => {
    expect(isValidSlug(fallbackSlug("AbCdEfGhIjKl"))).toBe(true);
    expect(fallbackSlug("AbCdEfGhIjKl")).toBe("post-abcdefgh");
  });
  it("suffix বাংলা সংখ্যায়", () => {
    expect(withSuffix("a", 1)).toBe("a");
    expect(withSuffix("a", 2)).toBe("a-২");
    expect(withSuffix("a", 12)).toBe("a-১২");
    expect(isValidSlug(withSuffix("a", 12))).toBe(true);
  });
});

describe("decideSlugClaim / nextHistory", () => {
  it("lock-মালিক অনুযায়ী", () => {
    expect(decideSlugClaim(null, "p1")).toBe("create");
    expect(decideSlugClaim("p1", "p1")).toBe("owned");
    expect(decideSlugClaim("p2", "p1")).toBe("taken");
  });
  it("history: পুরনো যোগ, নতুন বাদ, ডুপ্লিকেট নেই", () => {
    expect(nextHistory([], "a", "b")).toEqual(["a"]);
    expect(nextHistory(["a"], "b", "c")).toEqual(["a", "b"]);
    expect(nextHistory(["a", "b"], "c", "a")).toEqual(["b", "c"]);
    expect(nextHistory(["a"], "a", "b")).toEqual(["a"]);
  });
});
