import { describe, expect, it } from "vitest";
import { facebookError, siteLinkError, toggleAt } from "./layoutEdit";

describe("toggleAt", () => {
  it("শুধু i-তমটা উল্টায়; মূল অ্যারে বদলায় না; সীমার বাইরে অপরিবর্তিত", () => {
    const a = [
      { id: "x", enabled: true },
      { id: "y", enabled: false },
    ];
    expect(toggleAt(a, 1)).toEqual([
      { id: "x", enabled: true },
      { id: "y", enabled: true },
    ]);
    expect(toggleAt(a, 5)).toEqual(a);
    expect(a[1]!.enabled).toBe(false);
  });
});

describe("facebookError", () => {
  it("খালি ঠিক; http(s) ঠিক; javascript:/ভেতরের পথ/অতি-দীর্ঘ ভুল", () => {
    expect(facebookError("")).toBe(false);
    expect(facebookError("  ")).toBe(false);
    expect(facebookError("https://facebook.com/page")).toBe(false);
    expect(facebookError("javascript:alert(1)")).toBe(true);
    expect(facebookError("/blog")).toBe(true);
    expect(facebookError("https://a.com/" + "x".repeat(300))).toBe(true);
  });
});

describe("siteLinkError", () => {
  it("label ও http(s) url দুটোই লাগে", () => {
    expect(siteLinkError({ label: "ক", url: "https://a.com" })).toBeNull();
    expect(siteLinkError({ label: " ", url: "https://a.com" })).toBe("label");
    expect(siteLinkError({ label: "ক".repeat(61), url: "https://a.com" })).toBe("label");
    expect(siteLinkError({ label: "ক", url: "" })).toBe("url");
    expect(siteLinkError({ label: "ক", url: "/blog" })).toBe("url");
    expect(siteLinkError({ label: "ক", url: "data:text/html,x" })).toBe("url");
  });
});
