import { describe, expect, it } from "vitest";
import { isValidPostId, newId } from "./id";

describe("newId", () => {
  it("২০ অক্ষর, শুধু a-zA-Z0-9, প্রতিবার আলাদা", () => {
    const ids = Array.from({ length: 200 }, () => newId());
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(new Set(ids).size).toBe(200);
  });
});
describe("isValidPostId", () => {
  it("যাচাই", () => {
    expect(isValidPostId(newId())).toBe(true);
    expect(isValidPostId("")).toBe(false);
    expect(isValidPostId("a/b")).toBe(false);
    expect(isValidPostId("..")).toBe(false);
    expect(isValidPostId("a".repeat(41))).toBe(false);
  });
});
