import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/data/postRepo.wire", () => ({ getPostRepo: () => new Promise(() => undefined) }));
import { DiaryView } from "./DiaryView";

describe("DiaryView smoke (SSR)", () => {
  it("ক্যালেন্ডার ও লোডিং-অবস্থা রেন্ডার হয়", () => {
    const html = renderToString(createElement(DiaryView));
    expect(html).toContain("রবি");
    expect(html).toContain("আজকের দিনলিপি");
    expect(html).toContain("দিনলিপি আনা হচ্ছে");
    expect((html.match(/aria-pressed/g) ?? []).length).toBeGreaterThanOrEqual(28);
  });
});
