import { describe, expect, it } from "vitest";
import { parseBody, docToText } from "./editorDoc";
import {
  BUILTIN_IDS,
  TEMPLATE_NAME_MAX,
  builtinFor,
  builtinTemplates,
  cleanTemplateName,
  parseTplParam,
} from "./templates";

describe("builtinTemplates", () => {
  it("চারটি; ref অনন্য; প্রতিটির doc allowlist-sanitize-এ অক্ষত", () => {
    const t = builtinTemplates("১০ অক্টোবর ২০২৬");
    expect(t.map((x) => x.ref)).toEqual(["b:diary", "b:travel", "b:story", "b:poem"]);
    for (const x of t) expect(parseBody(JSON.stringify(x.doc))).toEqual(x.doc);
  });
  it("ডায়েরির শিরোনামে আজকের তারিখ-লেবেল", () => {
    expect(builtinFor("diary", "১০ অক্টোবর").title).toBe("ডায়েরি — ১০ অক্টোবর");
    expect(docToText(builtinFor("diary", "x").doc)).toContain("আজ যা ঘটল");
  });
});

describe("parseTplParam", () => {
  it("বৈধ বিল্ট-ইন ও user id", () => {
    for (const id of BUILTIN_IDS) expect(parseTplParam(`b:${id}`)).toEqual({ kind: "builtin", id });
    expect(parseTplParam("u:AbC123")).toEqual({ kind: "user", id: "AbC123" });
  });
  it("অচেনা/ভাঙা/অনিরাপদ → null", () => {
    for (const r of [
      null,
      undefined,
      "",
      "b:nope",
      "x:diary",
      "u:",
      "u:a/b",
      "u:../x",
      "diary",
      `u:${"a".repeat(41)}`,
    ]) {
      expect(parseTplParam(r)).toBeNull();
    }
  });
});

describe("cleanTemplateName", () => {
  it("ট্রিম/ফাঁকা-সংকোচন; খালি বা সীমা-ছাড়ানো → null", () => {
    expect(cleanTemplateName("  আমার   ছাঁচ ")).toBe("আমার ছাঁচ");
    expect(cleanTemplateName("   ")).toBeNull();
    expect(cleanTemplateName(null)).toBeNull();
    expect(cleanTemplateName("ক".repeat(TEMPLATE_NAME_MAX))).not.toBeNull();
    expect(cleanTemplateName("ক".repeat(TEMPLATE_NAME_MAX + 1))).toBeNull();
  });
});
