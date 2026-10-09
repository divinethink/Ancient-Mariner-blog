import { describe, expect, it } from "vitest";
import { classifyFile, extFromName, fitWithin } from "./media";

describe("media", () => {
  it("classifyFile: ছবি mime, অনুমোদিত extension; svg/exe/অজানা নয়", () => {
    expect(classifyFile("a.jpg", "image/jpeg")).toBe("image");
    expect(classifyFile("a.WEBP", "image/webp")).toBe("image");
    expect(classifyFile("নোট.PDF", "application/pdf")).toBe("file");
    expect(classifyFile("a.zip", "")).toBe("file");
    expect(classifyFile("a.svg", "image/svg+xml")).toBeNull();
    expect(classifyFile("a.exe", "application/x-msdownload")).toBeNull();
    expect(classifyFile("noext", "")).toBeNull();
  });
  it("extFromName", () => {
    expect(extFromName("x.tar.GZ")).toBe("gz");
    expect(extFromName("x.toolongext")).toBe("");
  });
  it("fitWithin: ছোট অপরিবর্তিত; বড় হলে অনুপাত ঠিক", () => {
    expect(fitWithin(1600, 900)).toEqual({ w: 1600, h: 900 });
    expect(fitWithin(4000, 3000)).toEqual({ w: 2000, h: 1500 });
    expect(fitWithin(3000, 6000)).toEqual({ w: 1000, h: 2000 });
    expect(fitWithin(0, 5)).toEqual({ w: 1, h: 1 });
  });
});
