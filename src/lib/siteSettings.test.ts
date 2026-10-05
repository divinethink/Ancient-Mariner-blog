import { describe, expect, it } from "vitest";
import { TIMEZONE_CHOICES, applyDefaultTheme, isValidTimeZone, timezoneChoices } from "./siteSettings";

describe("isValidTimeZone", () => {
  it("বৈধ IANA id মানে", () => {
    expect(isValidTimeZone("Asia/Dhaka")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });
  it("অবৈধ/খালি নাকচ", () => {
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("  ")).toBe(false);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
  });
  it("তালিকার সব মান বৈধ", () => {
    for (const tz of TIMEZONE_CHOICES) expect(isValidTimeZone(tz), tz).toBe(true);
  });
});

describe("timezoneChoices", () => {
  it("বর্তমান মান তালিকায় থাকলে অপরিবর্তিত", () => {
    expect(timezoneChoices("Asia/Dhaka")).toEqual([...TIMEZONE_CHOICES]);
  });
  it("তালিকার বাইরের মান শুরুতে যোগ হয়", () => {
    expect(timezoneChoices("Asia/Thimphu")[0]).toBe("Asia/Thimphu");
    expect(timezoneChoices("Asia/Thimphu")).toHaveLength(TIMEZONE_CHOICES.length + 1);
  });
});

describe("applyDefaultTheme", () => {
  const src = 'x();\n  var DEFAULT_THEME = "light";\n  y();';
  it("marker-এর মান বদলায়, বাকি অক্ষত", () => {
    expect(applyDefaultTheme(src, "dark")).toBe('x();\n  var DEFAULT_THEME = "dark";\n  y();');
    expect(applyDefaultTheme(applyDefaultTheme(src, "auto"), "light")).toBe(src); // পুনঃপ্রয়োগ নিরাপদ
  });
  it("marker না থাকলে throw", () => {
    expect(() => applyDefaultTheme("var A = 1;", "dark")).toThrow();
  });
});
