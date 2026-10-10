import { describe, expect, it } from "vitest";
import { DONE_AT, READ_PROGRESS_MAX, parseProgress, recordProgress, resumeFraction, serializeProgress } from "./readProgress";

describe("parseProgress", () => {
  it("নষ্ট/অচেনা/খালি → {}", () => {
    expect(parseProgress(null)).toEqual({});
    expect(parseProgress("{oops")).toEqual({});
    expect(parseProgress('{"v":2,"items":{}}')).toEqual({});
  });
  it("অবৈধ entry বাদ, মান [0,1]-এ আটকানো", () => {
    const m = parseProgress('{"v":1,"items":{"a":{"p":5,"t":1},"b":{"p":"x","t":1},"c":null}}');
    expect(m).toEqual({ a: { p: 1, t: 1 } });
  });
  it("serialize → parse round-trip", () => {
    const m = { a: { p: 0.4, t: 9 } };
    expect(parseProgress(serializeProgress(m))).toEqual(m);
  });
});
describe("recordProgress", () => {
  it("immutable; অবৈধ ইনপুটে অপরিবর্তিত", () => {
    const m = {};
    expect(recordProgress(m, "a", 0.3, 1)).toEqual({ a: { p: 0.3, t: 1 } });
    expect(m).toEqual({});
    expect(recordProgress(m, "", 0.3, 1)).toBe(m);
    expect(recordProgress(m, "a", NaN, 1)).toBe(m);
  });
  it("সীমা ছাড়ালে সবচেয়ে পুরনো বাদ", () => {
    let m = {};
    for (let i = 0; i < READ_PROGRESS_MAX + 5; i++) m = recordProgress(m, `s${i}`, 0.5, i);
    expect(Object.keys(m)).toHaveLength(READ_PROGRESS_MAX);
    expect(m).not.toHaveProperty("s0");
    expect(m).toHaveProperty(`s${READ_PROGRESS_MAX + 4}`);
  });
});
describe("resumeFraction", () => {
  const m = { a: { p: 0.01, t: 1 }, b: { p: 0.5, t: 1 }, c: { p: DONE_AT, t: 1 } };
  it("শুধু মাঝামাঝি হলে মান, নইলে null", () => {
    expect(resumeFraction(m, "a")).toBeNull();
    expect(resumeFraction(m, "b")).toBe(0.5);
    expect(resumeFraction(m, "c")).toBeNull();
    expect(resumeFraction(m, "none")).toBeNull();
  });
});
