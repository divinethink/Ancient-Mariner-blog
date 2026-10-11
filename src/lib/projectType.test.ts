import { describe, expect, it } from "vitest";
import { resolveType, splitType, typeLabel, TYPE_OTHER } from "./projectType";

const L = { novel: "উপন্যাস", biography: "জীবনী", travelogue: "ভ্রমণকাহিনি" } as Record<string, string>;

describe("projectType", () => {
  it("প্রিসেট ও কাস্টম লেবেল", () => {
    expect(typeLabel("biography", L)).toBe("জীবনী");
    expect(typeLabel("গবেষণা", L)).toBe("গবেষণা");
  });
  it("splitType", () => {
    expect(splitType("novel")).toEqual({ select: "novel", custom: "" });
    expect(splitType("গবেষণা")).toEqual({ select: TYPE_OTHER, custom: "গবেষণা" });
  });
  it("resolveType", () => {
    expect(resolveType("biography", "", L)).toBe("biography");
    expect(resolveType(TYPE_OTHER, "  গবেষণা  ", L)).toBe("গবেষণা");
    expect(resolveType(TYPE_OTHER, "জীবনী", L)).toBe("biography");
    expect(resolveType(TYPE_OTHER, "   ", L)).toBeNull();
    expect(resolveType("bogus", "", L)).toBeNull();
    expect(resolveType(TYPE_OTHER, "ক".repeat(80), L)!.length).toBe(40);
  });
});
