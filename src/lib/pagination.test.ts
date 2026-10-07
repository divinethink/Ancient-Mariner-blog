import { describe, expect, it } from "vitest";
import { pageCount, paginate } from "./pagination";

describe("pagination", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);
  it("pageCount: খালিতেও ১", () => {
    expect(pageCount(0, 10)).toBe(1);
    expect(pageCount(25, 10)).toBe(3);
    expect(pageCount(20, 10)).toBe(2);
    expect(pageCount(5, 0)).toBe(5); // pageSize ≥ ১
  });
  it("paginate: স্লাইস ও clamp", () => {
    expect(paginate(items, 1, 10).items).toHaveLength(10);
    expect(paginate(items, 3, 10)).toMatchObject({ page: 3, pages: 3, items: [21, 22, 23, 24, 25] });
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate(items, 0, 10).page).toBe(1);
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, pages: 1 });
  });
});
