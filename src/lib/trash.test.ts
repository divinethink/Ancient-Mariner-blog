import { describe, expect, it } from "vitest";
import { trashDaysLeft } from "./trash";

const D = 24 * 60 * 60 * 1000;
describe("trashDaysLeft", () => {
  const at = new Date(1_000_000_000_000);
  it("এইমাত্র ফেললে ৭", () => expect(trashDaysLeft(at, at.getTime())).toBe(7));
  it("আংশিক দিন উপরে ধরে", () => expect(trashDaysLeft(at, at.getTime() + 2.5 * D)).toBe(5));
  it("মেয়াদ পার হলে ০ (নেগেটিভ নয়)", () => expect(trashDaysLeft(at, at.getTime() + 9 * D)).toBe(0));
  it("ঘড়ি পিছিয়ে থাকলেও ৭-এর বেশি নয়", () => expect(trashDaysLeft(at, at.getTime() - D)).toBe(7));
});
